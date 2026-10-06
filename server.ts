import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStorageStatus } from './src/server/db.ts';
import {
  streamSnap,
  streamPrimaryAi,
  streamSecondaryAi,
  evaluateJudge,
  streamIdeaClashTurn,
  evaluateDebateClash,
  summarizeForNeuralSync,
  getClients,
  getProviderInfo,
} from './src/server/ai.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Default Presets
const DEFAULT_PRESETS = [
  {
    id: 'quick',
    name: 'Quick',
    description: 'Rapid concise perspectives, skips deep judge verification for high-speed triage.',
    responseLength: 'concise',
    skipJudge: true,
    skipSnap: false,
    tonePrefix: 'Be concise, punchy, and direct.',
    isDefault: true,
  },
  {
    id: 'deep',
    name: 'Deep',
    description: 'Exhaustive parallel breakdown, rigorous multi-point cross-examination and judge verification.',
    responseLength: 'comprehensive',
    skipJudge: false,
    skipSnap: false,
    tonePrefix: 'Deliver thorough, multi-layered empirical depth with structural breakdown.',
    isDefault: true,
  },
  {
    id: 'study',
    name: 'Study',
    description: 'Pedagogical, explanatory tone with intuitive metaphors and clear conceptual mechanics.',
    responseLength: 'balanced',
    skipJudge: false,
    skipSnap: false,
    tonePrefix: 'Explain conceptually with clarity, progressive disclosure, and educational structure.',
    isDefault: true,
  },
];

// In-memory preset storage (session-only)
let inMemoryCustomPresets: any[] = [];

// Helper for sending SSE messages safely
function sendSse(res: Response, event: string, data: any) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Helper to format clean human-readable error messages instead of raw JSON stacks
function cleanErrorMessage(err: any): string {
  const raw = String(err?.message || err || '');
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {}

  if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
    return 'The AI model is momentarily experiencing high upstream demand. A retry or second attempt usually resolves this quickly.';
  }
  if (raw.includes('429') || raw.includes('Quota') || raw.includes('rate limit')) {
    return 'Rate limit encountered. Please pause for a few seconds before submitting again.';
  }
  return raw || 'Pipeline processing encountered a temporary error.';
}

// 1. Status API
app.get('/api/system-status', (_req: Request, res: Response) => {
  const providers = getProviderInfo();

  res.json({
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    providers,
    storage: getStorageStatus(),
    status: 'online',
  });
});

// 2. Presets API (In-Memory per session)
app.get('/api/presets', (_req: Request, res: Response) => {
  res.json([...DEFAULT_PRESETS, ...inMemoryCustomPresets]);
});

app.post('/api/presets', (req: Request, res: Response) => {
  const newPreset = {
    id: 'custom-' + Date.now(),
    name: req.body.name || 'Custom Preset',
    description: req.body.description || 'Custom user preset',
    responseLength: req.body.responseLength || 'balanced',
    skipJudge: Boolean(req.body.skipJudge),
    skipSnap: Boolean(req.body.skipSnap),
    tonePrefix: req.body.tonePrefix || '',
    isDefault: false,
  };

  inMemoryCustomPresets.push(newPreset);
  res.json(newPreset);
});

app.delete('/api/presets/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  inMemoryCustomPresets = inMemoryCustomPresets.filter(p => p.id !== id);
  res.json({ success: true });
});

// 3. FactForge SSE Pipeline (Feature 1, 3, 4, 5, 6)
app.post('/api/fact-forge', async (req: Request, res: Response) => {
  const {
    query,
    mode = 'auto',
    presetId = 'deep',
    customPreset,
    tokenSaverActive = false,
    snapOnly = false,
    neuralSyncMode = 'off',
    neuralContext = '',
  } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Determine preset configuration
  const activePreset = customPreset ||
    DEFAULT_PRESETS.find(p => p.id === presetId) ||
    inMemoryCustomPresets.find(p => p.id === presetId) ||
    DEFAULT_PRESETS[1];

  try {
    // Step A: Snap Generation (Feature 4: Instant response layer)
    let snapResult = '';
    if (!activePreset.skipSnap) {
      sendSse(res, 'snap_start', { timestamp: Date.now() });
      snapResult = await streamSnap(query, (chunk) => {
        sendSse(res, 'snap_chunk', { chunk });
      });
      sendSse(res, 'snap_done', { fullText: snapResult });
    }

    // Feature 5 (Token Saver): If token saver is ON and snapOnly requested, halt here
    if (tokenSaverActive && snapOnly) {
      sendSse(res, 'awaiting_token_saver_decision', { snapText: snapResult });
      sendSse(res, 'done', { haltedForTokenSaver: true });
      res.end();
      return;
    }

    // Step B: Parallel Primary & Secondary AI generation
    sendSse(res, 'pipeline_start', { mode, preset: activePreset.name });

    let primaryAccumulator = '';
    let secondaryAccumulator = '';

    const primaryPromise = streamPrimaryAi(
      query,
      {
        tonePrefix: activePreset.tonePrefix,
        responseLength: activePreset.responseLength,
        neuralContext: neuralSyncMode !== 'off' ? neuralContext : undefined,
      },
      (chunk) => {
        primaryAccumulator += chunk;
        sendSse(res, 'primary_chunk', { chunk });
      }
    ).then((full) => {
      sendSse(res, 'primary_done', { fullText: full });
      return full;
    });

    const secondaryPromise = streamSecondaryAi(
      query,
      {
        tonePrefix: activePreset.tonePrefix,
        responseLength: activePreset.responseLength,
        neuralContext: neuralSyncMode !== 'off' ? neuralContext : undefined,
      },
      (chunk) => {
        secondaryAccumulator += chunk;
        sendSse(res, 'secondary_chunk', { chunk });
      }
    ).then((full) => {
      sendSse(res, 'secondary_done', { fullText: full });
      return full;
    });

    // Run in parallel (Promise.all)
    const [primaryText, secondaryText] = await Promise.all([primaryPromise, secondaryPromise]);

    // Step C: Judge AI Verification Layer (Auto mode only, unless skipped by preset)
    if (mode === 'auto' && !activePreset.skipJudge) {
      sendSse(res, 'judge_start', { timestamp: Date.now() });
      const verdict = await evaluateJudge(query, primaryText, secondaryText);
      sendSse(res, 'judge_verdict', verdict);
    }

    // Step D: NeuralSync Context Handoff (Feature 3)
    if (neuralSyncMode !== 'off') {
      const summary = await summarizeForNeuralSync(
        { query, primary: primaryText, secondary: secondaryText },
        neuralSyncMode
      );
      if (summary) {
        sendSse(res, 'neuralsync_update', { summary });
      }
    }

    sendSse(res, 'done', { success: true });
    res.end();
  } catch (err: any) {
    console.error('[FactForge Pipeline Error]', err);
    sendSse(res, 'error', { message: cleanErrorMessage(err) });
    res.end();
  }
});

// 4. Idea Clash Debate SSE Pipeline (Feature 2)
app.post('/api/idea-clash', async (req: Request, res: Response) => {
  const { topic, rounds = 5 } = req.body;

  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ error: 'Topic is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const totalRounds = Math.min(Math.max(Number(rounds) || 5, 3), 7);

  try {
    // Initial Stance Assignment
    const alphaStance = `Affirmative / Thesis: Championing the core structural and progressive advantages of "${topic}".`;
    const betaStance = `Critical / Antithesis: Challenging foundational assumptions, highlighting counter-evidence and hidden costs regarding "${topic}".`;

    sendSse(res, 'debate_setup', {
      topic,
      totalRounds,
      alphaStance,
      betaStance,
    });

    const transcript: { speaker: string; text: string }[] = [];

    // Loop through debate rounds sequentially
    for (let r = 1; r <= totalRounds; r++) {
      // 1. Debater Alpha Turn
      sendSse(res, 'turn_start', { round: r, speaker: 'alpha', speakerName: 'Model Alpha' });
      const alphaSpeech = await streamIdeaClashTurn(
        topic,
        r,
        'alpha',
        alphaStance,
        transcript,
        (chunk) => {
          sendSse(res, 'turn_chunk', { round: r, speaker: 'alpha', chunk });
        }
      );
      transcript.push({ speaker: 'Model Alpha', text: alphaSpeech });
      sendSse(res, 'turn_done', { round: r, speaker: 'alpha', fullText: alphaSpeech });

      // 2. Debater Beta Turn
      sendSse(res, 'turn_start', { round: r, speaker: 'beta', speakerName: 'Model Beta' });
      const betaSpeech = await streamIdeaClashTurn(
        topic,
        r,
        'beta',
        betaStance,
        transcript,
        (chunk) => {
          sendSse(res, 'turn_chunk', { round: r, speaker: 'beta', chunk });
        }
      );
      transcript.push({ speaker: 'Model Beta', text: betaSpeech });
      sendSse(res, 'turn_done', { round: r, speaker: 'beta', fullText: betaSpeech });
    }

    // Step 3: Judge Synthesis & Verdict
    sendSse(res, 'verdict_start', { timestamp: Date.now() });
    const finalVerdictMarkdown = await evaluateDebateClash(topic, transcript);
    sendSse(res, 'clash_verdict', { verdict: finalVerdictMarkdown });
    sendSse(res, 'done', { success: true });
    res.end();
  } catch (err: any) {
    console.error('[Idea Clash Error]', err);
    sendSse(res, 'error', { message: cleanErrorMessage(err) });
    res.end();
  }
});

// Vite Middleware (Dev) vs Static Files (Prod)
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DualMind Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
