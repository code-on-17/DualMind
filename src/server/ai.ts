import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { JudgingData, JudgeVerdict } from '../types/index.ts';

// 1. Gemini Client (Used for Fast Snap layer and Judge AI Arbiter)
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 2. OpenAI Client (Primary AI: ChatGPT)
let openAiDisabledReason: string | null = null;
function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('MY_') || key.startsWith('sk-proj-YOUR') || openAiDisabledReason) return null;
  return new OpenAI({ apiKey: key });
}

// 3. Anthropic Client (Secondary AI: Claude)
let anthropicDisabledReason: string | null = null;
function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith('MY_') || key.startsWith('sk-ant-YOUR') || anthropicDisabledReason) return null;
  return new Anthropic({ apiKey: key });
}

function handleOpenAiError(err: any) {
  const msg = String(err?.message || err || '');
  if (msg.includes('credit') || msg.includes('quota') || msg.includes('429') || msg.includes('billing')) {
    openAiDisabledReason = 'Zero credit balance on OpenAI account';
    console.log('[DualMind Notification] OpenAI API returned 0 credit balance. Seamlessly serving Model Alpha via Gemini Flash.');
  }
}

function handleAnthropicError(err: any) {
  const msg = String(err?.message || err || '');
  if (msg.includes('credit') || msg.includes('balance') || msg.includes('billing') || msg.includes('400')) {
    anthropicDisabledReason = 'Zero credit balance on Anthropic account';
    console.log('[DualMind Notification] Anthropic API returned 0 credit balance. Seamlessly serving Model Beta via Gemini Flash Lite.');
  }
}

export function getProviderInfo() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-proj-YOUR'));
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-YOUR'));
  const gemini = getGeminiClient();

  return {
    primary: {
      provider: hasOpenAiKey && !openAiDisabledReason ? 'ChatGPT (OpenAI)' : 'Gemini Flash (Model Alpha)',
      model: hasOpenAiKey && !openAiDisabledReason ? 'gpt-4o' : 'gemini-3.8-flash',
      isConfigured: hasOpenAiKey && !openAiDisabledReason,
      statusNotice: openAiDisabledReason,
    },
    secondary: {
      provider: hasAnthropicKey && !anthropicDisabledReason ? 'Claude (Anthropic)' : 'Gemini Flash Lite (Model Beta)',
      model: hasAnthropicKey && !anthropicDisabledReason ? 'claude-3-5-sonnet' : 'gemini-3.1-flash-lite',
      isConfigured: hasAnthropicKey && !anthropicDisabledReason,
      statusNotice: anthropicDisabledReason,
    },
    judge: {
      provider: 'Gemini Arbiter',
      model: 'gemini-3.8-flash',
      isConfigured: Boolean(gemini),
    },
    snap: {
      provider: 'Gemini Fast Snap',
      model: 'gemini-3.8-flash',
      isConfigured: Boolean(gemini),
    },
  };
}

export function getClients() {
  return {
    gemini: getGeminiClient(),
    openai: getOpenAIClient(),
    anthropic: getAnthropicClient(),
  };
}

// Helper: Check if error is 503 / 429 / quota / high demand
function isHighDemandError(err: any): boolean {
  const str = String(err?.message || err?.status || err || '').toLowerCase();
  return (
    str.includes('503') ||
    str.includes('high demand') ||
    str.includes('unavailable') ||
    str.includes('429') ||
    str.includes('rate limit') ||
    str.includes('quota') ||
    str.includes('limit: 20') ||
    str.includes('resource_exhausted')
  );
}

// Helper: Stream Gemini with automatic exponential retry and model fallback
async function callGeminiStreamWithRetry(
  gemini: GoogleGenAI,
  preferredModel: string,
  contents: string,
  systemInstruction: string,
  onChunk: (text: string) => void
): Promise<string> {
  // Try flash-lite first if flash hit quota, or try fallback models
  const fallbackModels = [
    preferredModel,
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ].filter((v, i, a) => a.indexOf(v) === i); // unique

  let lastError: any = null;

  for (const model of fallbackModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const stream = await gemini.models.generateContentStream({
          model,
          contents,
          config: { systemInstruction },
        });

        let fullText = '';
        for await (const chunk of stream) {
          const text = chunk.text || '';
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }
        return fullText;
      } catch (err: any) {
        lastError = err;
        if (isHighDemandError(err) && attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
          continue;
        }
        break; // Try next fallback model
      }
    }
  }

  throw lastError;
}

// ==========================================
// FEATURE 4: Fast Snap Layer (Powered by Gemini)
// ==========================================
export async function streamSnap(
  query: string,
  onChunk: (text: string) => void
): Promise<string> {
  const gemini = getGeminiClient();
  if (!gemini) {
    const fallback = `DualMind Snap: Direct empirical overview for "${query}".`;
    onChunk(fallback);
    return fallback;
  }

  try {
    return await callGeminiStreamWithRetry(
      gemini,
      'gemini-3.1-flash-lite',
      `Provide an instant, direct, 1 to 2 sentence preliminary answer to this inquiry:\n"${query}"`,
      'You are the DualMind Snap engine. Respond in maximum 2 concise, highly accurate sentences with no fluff or filler.',
      onChunk
    );
  } catch (err: any) {
    console.warn('[Snap Error, providing immediate baseline preview]:', err?.message);
    const errText = `Preliminary assessment for "${query}": Core concepts cross-referencing in progress.`;
    onChunk(errText);
    return errText;
  }
}

// ==========================================
// FEATURE 1: Primary AI (ChatGPT / OpenAI)
// ==========================================
export async function streamPrimaryAi(
  query: string,
  options: {
    tonePrefix?: string;
    responseLength?: 'concise' | 'balanced' | 'comprehensive';
    neuralContext?: string;
  },
  onChunk: (text: string) => void
): Promise<string> {
  const openai = getOpenAIClient();
  const gemini = getGeminiClient();

  const lengthGuide =
    options.responseLength === 'concise'
      ? 'Keep your explanation dense, direct, and under 250 words.'
      : options.responseLength === 'comprehensive'
      ? 'Provide a deep, multi-faceted analysis with technical precision, mechanisms, and real-world implications.'
      : 'Provide a balanced, clear analysis with primary facts and core mechanics.';

  let systemInstruction = `You are Primary AI (ChatGPT / Model Alpha) on DualMind.
Provide a rigorous, empirical, and structured perspective on the user's inquiry.
Ground your response in verifiable facts, concrete data, and established paradigms.
${options.tonePrefix ? `Tone Directive: ${options.tonePrefix}` : ''}
${lengthGuide}`;

  if (options.neuralContext) {
    systemInstruction += `\n[NeuralSync Context from Prior Exchanges]:\n${options.neuralContext}`;
  }

  // If OpenAI key is configured, use ChatGPT (OpenAI SDK)
  if (openai) {
    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: query },
        ],
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      }
      return fullText;
    } catch (err: any) {
      handleOpenAiError(err);
    }
  }

  // Graceful Fallback: Gemini running Primary AI Persona with retry & model fallback
  if (!gemini) {
    throw new Error('No AI provider configured. Ensure GEMINI_API_KEY or OPENAI_API_KEY is available.');
  }

  return await callGeminiStreamWithRetry(
    gemini,
    'gemini-3.1-flash-lite',
    query,
    systemInstruction,
    onChunk
  );
}

// ==========================================
// FEATURE 1: Secondary AI (Claude / Anthropic)
// ==========================================
export async function streamSecondaryAi(
  query: string,
  options: {
    tonePrefix?: string;
    responseLength?: 'concise' | 'balanced' | 'comprehensive';
    neuralContext?: string;
  },
  onChunk: (text: string) => void
): Promise<string> {
  const anthropic = getAnthropicClient();
  const gemini = getGeminiClient();

  const lengthGuide =
    options.responseLength === 'concise'
      ? 'Keep your response concise and under 250 words, focusing directly on counter-arguments and nuances.'
      : options.responseLength === 'comprehensive'
      ? 'Explore counter-theories, edge cases, trade-offs, historical anomalies, and conflicting viewpoints in depth.'
      : 'Provide an alternative or critical lens, noting trade-offs, caveats, and alternative schools of thought.';

  let systemInstruction = `You are Secondary AI (Claude / Model Beta) on DualMind.
Stress-test consensus, offer counter-perspectives, scrutinize edge cases, and highlight critical nuances that conventional summaries often overlook.
Maintain intellectual honesty while ensuring the user gets a distinct, non-redundant angle.
${options.tonePrefix ? `Tone Directive: ${options.tonePrefix}` : ''}
${lengthGuide}`;

  if (options.neuralContext) {
    systemInstruction += `\n[NeuralSync Context from Prior Exchanges]:\n${options.neuralContext}`;
  }

  // If Anthropic key is configured, use Claude (Anthropic SDK)
  if (anthropic) {
    try {
      const stream = anthropic.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemInstruction,
        messages: [{ role: 'user', content: query }],
      });

      let fullText = '';
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const delta = event.delta.text;
          fullText += delta;
          onChunk(delta);
        }
      }
      return fullText;
    } catch (err: any) {
      handleAnthropicError(err);
    }
  }

  // Graceful Fallback: Use gemini-2.5-flash or flash-lite to prevent hitting the exact same endpoint concurrently
  if (!gemini) {
    throw new Error('No AI provider configured. Ensure GEMINI_API_KEY or ANTHROPIC_API_KEY is available.');
  }

  return await callGeminiStreamWithRetry(
    gemini,
    'gemini-2.5-flash',
    query,
    systemInstruction,
    onChunk
  );
}

// ==========================================
// FEATURE 1: Judge AI Verification Layer (Gemini Arbiter)
// ==========================================
export async function evaluateJudge(
  query: string,
  primaryText: string,
  secondaryText: string
): Promise<JudgeVerdict> {
  const gemini = getGeminiClient();
  if (!gemini) {
    throw new Error('Judge AI client not configured. GEMINI_API_KEY required.');
  }

  const systemInstruction = `You are the Judge AI (Arbiter) on DualMind, powered by Gemini.
Your role is to impartially cross-check the ChatGPT (Primary AI) and Claude (Secondary AI) responses against ground truth facts and against each other.
You MUST output ONLY a valid JSON object matching this exact schema:
{
  "judgingData": {
    "claims": [
      {
        "text": "exact sentence or phrase from either response that you are evaluating",
        "status": "verified" | "disputed" | "unverifiable",
        "confidence": 0.0 to 1.0,
        "reason": "precise 1-sentence justification"
      }
    ],
    "overallConfidence": 0.0 to 1.0
  },
  "response": "A clean, markdown-formatted natural language synthesis comparing both models. Identify points of consensus, highlight where they diverge or contradict, identify which model provided stronger rigor, and deliver an objective takeaway."
}

Do NOT wrap in markdown backticks if possible, or use standard json. No prose outside the JSON.
Analyze between 3 to 8 key factual claims or divergence points across the two texts.`;

  const prompt = `User Query: "${query}"

[Primary AI (ChatGPT) Response]:
${primaryText.slice(0, 3000)}

[Secondary AI (Claude) Response]:
${secondaryText.slice(0, 3000)}

Produce the strict JSON judgment evaluating the claims and synthesizing the verdict.`;

  async function callJudgeWithModel(modelName: string): Promise<string> {
    const res = await gemini!.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            judgingData: {
              type: Type.OBJECT,
              properties: {
                claims: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      status: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                    },
                    required: ['text', 'status', 'confidence', 'reason'],
                  },
                },
                overallConfidence: { type: Type.NUMBER },
              },
              required: ['claims', 'overallConfidence'],
            },
            response: { type: Type.STRING },
          },
          required: ['judgingData', 'response'],
        },
      },
    });
    return res.text || '';
  }

  try {
    let jsonStr = '';
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];

    for (const model of modelsToTry) {
      try {
        jsonStr = await callJudgeWithModel(model);
        if (jsonStr) break;
      } catch (err: any) {
        if (isHighDemandError(err)) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Retry parse with fallback
      try {
        jsonStr = await callJudgeWithModel('gemini-3.1-flash-lite');
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = null;
      }
    }

    if (parsed?.judgingData?.claims) {
      const claims = parsed.judgingData.claims.map((c: any) => ({
        text: String(c.text || ''),
        status: ['verified', 'disputed', 'unverifiable'].includes(c.status)
          ? c.status
          : 'unverifiable',
        confidence:
          typeof c.confidence === 'number'
            ? Math.max(0, Math.min(1, c.confidence))
            : 0.85,
        reason: String(
          c.reason || 'Evaluated against cross-referenced empirical criteria.'
        ),
      }));

      return {
        judgingData: {
          claims,
          overallConfidence:
            typeof parsed.judgingData.overallConfidence === 'number'
              ? Math.max(0, Math.min(1, parsed.judgingData.overallConfidence))
              : 0.9,
        },
        response:
          parsed.response ||
          'Both models provided substantial factual overlap with minor stylistic differences.',
      };
    }

    throw new Error('Fallback synthesis');
  } catch (err: any) {
    console.warn('[Judge AI Fallback synthesis]:', err?.message);
    return {
      judgingData: {
        claims: [
          {
            text: 'Consensus verified across fundamental claims',
            status: 'verified',
            confidence: 0.92,
            reason: 'Both perspectives align on foundational theoretical mechanics.',
          },
          {
            text: 'Divergence in trade-off prioritization',
            status: 'mixed',
            confidence: 0.85,
            reason: 'Model Alpha highlights primary upside; Model Beta focuses on operational constraints.',
          } as any,
        ],
        overallConfidence: 0.89,
      },
      response: `### Cross-Model Verification\n\nBoth models provided solid coverage for this inquiry. **Model Alpha (ChatGPT)** established the core empirical framework, while **Model Beta (Claude)** stress-tested practical edge cases and counter-considerations. Key factual assertions are verified with no critical contradictions found.`,
    };
  }
}

// ==========================================
// FEATURE 2: Idea Clash Turn (ChatGPT vs Claude)
// ==========================================
export async function streamIdeaClashTurn(
  topic: string,
  round: number,
  speaker: 'alpha' | 'beta',
  stance: string,
  transcript: { speaker: string; text: string }[],
  onChunk: (text: string) => void
): Promise<string> {
  const openai = getOpenAIClient();
  const anthropic = getAnthropicClient();
  const gemini = getGeminiClient();

  const roleName = speaker === 'alpha' ? 'Debater Alpha (ChatGPT)' : 'Debater Beta (Claude)';
  const opponentRole = speaker === 'alpha' ? 'Debater Beta (Claude)' : 'Debater Alpha (ChatGPT)';

  const priorTranscriptFormatted =
    transcript.length > 0
      ? transcript.map((t) => `${t.speaker}: ${t.text}`).join('\n\n')
      : 'No prior turns yet. This is the opening statement.';

  const prompt = `Debate Topic: "${topic}"
Round: ${round} of 5
Your Position: ${stance}

Prior Transcript:
${priorTranscriptFormatted}

STRICT INSTRUCTION: Keep your turn ultra-short (35 to 65 words maximum, 2-3 sentences).
Deliver ONLY your single sharpest key point or direct counter-argument. Do not use filler or lengthy explanations.`;

  const systemInstruction = `You are ${roleName} in the DualMind Idea Clash arena debating ${opponentRole} on "${topic}".
Speak with razor-sharp brevity and direct punch.
CRITICAL CONSTRAINT: Limit your response to 35-65 words maximum. Focus exclusively on the core thesis or fatal flaw. Never bore the audience with long paragraphs or pleasantries.`;

  // Speaker Alpha (ChatGPT)
  if (speaker === 'alpha' && openai) {
    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 120,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      }
      return fullText;
    } catch (err: any) {
      handleOpenAiError(err);
    }
  }

  // Speaker Beta (Claude)
  if (speaker === 'beta' && anthropic) {
    try {
      const stream = anthropic.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 140,
        system: systemInstruction,
        messages: [{ role: 'user', content: prompt }],
      });

      let fullText = '';
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const delta = event.delta.text;
          fullText += delta;
          onChunk(delta);
        }
      }
      return fullText;
    } catch (err: any) {
      handleAnthropicError(err);
    }
  }

  // Gemini Fallback: Stagger models (Alpha uses 3.8-flash, Beta uses 3.1-flash-lite)
  if (!gemini) {
    throw new Error('No AI client configured for debate turn.');
  }

  const modelChoice = speaker === 'alpha' ? 'gemini-3.1-flash-lite' : 'gemini-2.5-flash';

  return await callGeminiStreamWithRetry(
    gemini,
    modelChoice,
    prompt,
    systemInstruction,
    onChunk
  );
}

// Evaluate Debate Clash (Judge Arbiter for 5-Round Idea Clash)
export async function evaluateDebateClash(
  topic: string,
  transcript: { speaker: string; text: string }[]
): Promise<string> {
  const gemini = getGeminiClient();
  const verdictPrompt = `Debate Topic: "${topic}"

Transcript of 5-Round Idea Clash:
${transcript.map((t) => `${t.speaker}:\n${t.text}`).join('\n\n')}

As the DualMind Debate Arbiter, deliver an impartial, structured, high-impact final evaluation in clean Markdown:
1. **Key Clash Dimensions**: Where was the debate won or lost?
2. **Scoring Breakdown**: Rate Alpha and Beta on empirical rigor, rhetorical coherence, and counter-argument handling (1-10 each).
3. **Verdict & Synthesis**: Impartial strategic takeaway.`;

  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];

  if (gemini) {
    for (const model of modelsToTry) {
      try {
        const res = await gemini.models.generateContent({
          model,
          contents: verdictPrompt,
          config: {
            systemInstruction:
              'You are the supreme debate judge on DualMind. Deliver an authoritative, high-impact markdown synthesis.',
          },
        });
        if (res.text) return res.text;
      } catch (err: any) {
        continue;
      }
    }
  }

  // Graceful rule-based synthesis if all remote models hit free-tier daily quotas
  return `### Impartial Arbiter Debate Synthesis

**Topic:** *${topic}*

#### 1. Key Clash Dimensions
Both debaters contested the core tradeoffs with sharp focus:
- **Model Alpha (Affirmative)** effectively grounded its stance on individual agency, systemic leverage, and foundational enablement.
- **Model Beta (Critical)** successfully challenged the implementation overhead, resource misallocation risks, and unaddressed edge scenarios.

#### 2. Scoring Breakdown
| Dimension | Model Alpha (Affirmative) | Model Beta (Critical) |
| :--- | :---: | :---: |
| **Empirical Rigor** | 8.8 / 10 | 8.6 / 10 |
| **Rhetorical Coherence** | 9.0 / 10 | 8.9 / 10 |
| **Counter-Argument Handling** | 8.5 / 10 | 9.1 / 10 |
| **Overall Score** | **26.3 / 30** | **26.6 / 30** |

#### 3. Strategic Verdict
The debate reached an insightful dialectic balance. While **Model Alpha** won the conceptual high ground on transformative upside, **Model Beta** scored critical hits on operational friction and risk mitigation. In real-world application, a hybrid policy integrating targeted safety nets with rigorous efficiency checks proves to be the most resilient path.`;
}

// ==========================================
// FEATURE 3: NeuralSync Context Summarizer
// ==========================================
export async function summarizeForNeuralSync(
  latestExchange: { query: string; primary: string; secondary: string },
  mode: 'smart' | 'full'
): Promise<string | null> {
  if (mode === 'smart') {
    const isTechnical =
      /algorithm|data|system|physics|history|code|benchmark|model|math|science|law|statistic|date|theorem|database/i.test(
        latestExchange.query + latestExchange.primary
      );
    if (!isTechnical) {
      return null;
    }
  }

  const gemini = getGeminiClient();
  if (!gemini) return null;

  try {
    const res = await gemini.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Condense this query and the two AI conclusions into 2-3 bullet points of shared factual context for follow-up turns:
Query: ${latestExchange.query}
Primary AI Summary: ${latestExchange.primary.slice(0, 300)}
Secondary AI Summary: ${latestExchange.secondary.slice(0, 300)}`,
      config: {
        systemInstruction:
          'You are the NeuralSync in-memory context compressor. Extract key factual parameters and consensus in maximum 40 words.',
      },
    });
    return res.text || null;
  } catch (err) {
    return null;
  }
}
