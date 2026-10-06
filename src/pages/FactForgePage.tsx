import React, { useState, useRef } from 'react';
import {
  Send,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  SlidersHorizontal,
  Scale,
  Columns,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useDualMind } from '../context/DualMindContext.tsx';
import { PipelineMode, JudgeVerdict } from '../types/index.ts';
import { SnapCard } from '../components/SnapCard.tsx';
import { ResponsePanel } from '../components/ResponsePanel.tsx';
import { JudgeVerdictCard } from '../components/JudgeVerdictCard.tsx';

const SAMPLE_PROMPTS = [
  'Will post-quantum cryptography fully replace RSA before 2030?',
  'Is Rust objectively superior to modern C++ for kernel development?',
  'Can fusion reactors achieve commercially viable net electricity within 15 years?',
  'Does remote work structurally harm long-term organizational innovation velocity?',
];

export const FactForgePage: React.FC = () => {
  const {
    activePreset,
    tokenSaver,
    neuralSync,
    neuralContext,
    setNeuralContext,
  } = useDualMind();

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [mode, setMode] = useState<PipelineMode>('auto');

  // Active view once ready: 'evaluated' (Judge synthesis) | 'dual' (Side-by-Side)
  const [activeView, setActiveView] = useState<'evaluated' | 'dual'>('evaluated');
  const [showSnapEvenIfEvaluated, setShowSnapEvenIfEvaluated] = useState(false);

  // Streaming & Pipeline States
  const [snapText, setSnapText] = useState('');
  const [isSnapLoading, setIsSnapLoading] = useState(false);
  const [isTokenSaverAwaiting, setIsTokenSaverAwaiting] = useState(false);

  const [primaryText, setPrimaryText] = useState('');
  const [isPrimaryLoading, setIsPrimaryLoading] = useState(false);
  const [isPrimaryDone, setIsPrimaryDone] = useState(false);

  const [secondaryText, setSecondaryText] = useState('');
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const [isSecondaryDone, setIsSecondaryDone] = useState(false);

  const [judgeVerdict, setJudgeVerdict] = useState<JudgeVerdict | null>(null);
  const [isJudgeLoading, setIsJudgeLoading] = useState(false);

  // Dynamic live status ticker line
  const [backgroundStatus, setBackgroundStatus] = useState<string | null>(null);

  const [expandedPanel, setExpandedPanel] = useState<'primary' | 'secondary' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeAbortController = useRef<AbortController | null>(null);

  // Compute Overall Verdict badges based on claims
  const getOverallVerdict = (verdict: JudgeVerdict | null) => {
    if (!verdict || !verdict.judgingData || !verdict.judgingData.claims) return undefined;
    const claims = verdict.judgingData.claims;
    if (claims.length === 0) return 'Verified';
    const disputed = claims.filter((c) => c.status === 'disputed').length;
    const verified = claims.filter((c) => c.status === 'verified').length;
    if (disputed === 0) return 'Verified';
    if (verified === 0) return 'Disputed';
    return 'Mixed';
  };

  const overallVerdict = getOverallVerdict(judgeVerdict);

  // Execute pipeline
  const executeFactForge = async (submitQuery: string, forceFullPipeline = false) => {
    if (!submitQuery.trim()) return;

    if (activeAbortController.current) {
      activeAbortController.current.abort();
    }
    const abortController = new AbortController();
    activeAbortController.current = abortController;

    setSubmittedQuery(submitQuery);
    setHasSearched(true);
    setError(null);
    setSnapText('');
    setPrimaryText('');
    setSecondaryText('');
    setIsPrimaryDone(false);
    setIsSecondaryDone(false);
    setJudgeVerdict(null);
    setIsTokenSaverAwaiting(false);
    setShowSnapEvenIfEvaluated(false);
    setActiveView('evaluated');

    const shouldRunSnapOnly = tokenSaver && !forceFullPipeline;

    if (!activePreset.skipSnap) {
      setIsSnapLoading(true);
    }
    if (!shouldRunSnapOnly) {
      setIsPrimaryLoading(true);
      setIsSecondaryLoading(true);
      setBackgroundStatus('ChatGPT and Claude are analyzing in parallel...');
      if (mode === 'auto' && !activePreset.skipJudge) {
        setIsJudgeLoading(true);
      }
    } else {
      setBackgroundStatus(null);
    }

    try {
      const response = await fetch('/api/fact-forge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          query: submitQuery,
          mode,
          presetId: activePreset.id,
          customPreset: activePreset,
          tokenSaverActive: tokenSaver,
          snapOnly: shouldRunSnapOnly,
          neuralSyncMode: neuralSync,
          neuralContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Unable to read stream');

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          if (!evt.trim()) continue;
          const lines = evt.split('\n');
          let eventName = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventName = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (!dataStr) continue;
          const payload = JSON.parse(dataStr);

          switch (eventName) {
            case 'snap_chunk':
              setSnapText((prev) => prev + (payload.chunk || ''));
              break;
            case 'snap_done':
              setSnapText(payload.fullText || '');
              setIsSnapLoading(false);
              break;
            case 'awaiting_token_saver_decision':
              setIsTokenSaverAwaiting(true);
              setIsSnapLoading(false);
              setIsPrimaryLoading(false);
              setIsSecondaryLoading(false);
              setIsJudgeLoading(false);
              setBackgroundStatus(null);
              break;
            case 'primary_chunk':
              setPrimaryText((prev) => prev + (payload.chunk || ''));
              break;
            case 'primary_done':
              setPrimaryText(payload.fullText || '');
              setIsPrimaryLoading(false);
              setIsPrimaryDone(true);
              setBackgroundStatus((prev) =>
                prev && prev.includes('Claude has formulated')
                  ? 'Both models completed · Gemini Arbiter cross-examining...'
                  : 'ChatGPT formulated response · Claude analyzing edge cases...'
              );
              break;
            case 'secondary_chunk':
              setSecondaryText((prev) => prev + (payload.chunk || ''));
              break;
            case 'secondary_done':
              setSecondaryText(payload.fullText || '');
              setIsSecondaryLoading(false);
              setIsSecondaryDone(true);
              setBackgroundStatus((prev) =>
                prev && prev.includes('ChatGPT formulated')
                  ? 'Both models completed · Gemini Arbiter cross-examining...'
                  : 'Claude formulated response · ChatGPT finalizing analysis...'
              );
              break;
            case 'judge_start':
              setIsJudgeLoading(true);
              setBackgroundStatus('Both models completed · Gemini Arbiter cross-examining claims...');
              break;
            case 'judge_verdict':
              setJudgeVerdict(payload);
              setIsJudgeLoading(false);
              setBackgroundStatus(null);
              setActiveView('evaluated');
              break;
            case 'neuralsync_update':
              if (payload.summary) {
                setNeuralContext((prev) =>
                  prev ? `${prev}\n- ${payload.summary}` : `- ${payload.summary}`
                );
              }
              break;
            case 'error':
              setError(payload.message || 'Error occurred during generation');
              setIsPrimaryLoading(false);
              setIsSecondaryLoading(false);
              setIsJudgeLoading(false);
              setIsSnapLoading(false);
              setBackgroundStatus(null);
              break;
            case 'done':
              setIsPrimaryLoading(false);
              setIsSecondaryLoading(false);
              setIsJudgeLoading(false);
              setIsSnapLoading(false);
              if (mode === 'manual') {
                setActiveView('dual');
                setBackgroundStatus(null);
              }
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to stream response');
      }
    } finally {
      setIsPrimaryLoading(false);
      setIsSecondaryLoading(false);
      setIsJudgeLoading(false);
      setIsSnapLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeFactForge(query);
  };

  const handleSelectSample = (sample: string) => {
    setQuery(sample);
    executeFactForge(sample);
  };

  const isPipelineGenerating = isPrimaryLoading || isSecondaryLoading || isJudgeLoading;
  const hasEvaluatedAnswer = Boolean(judgeVerdict);
  const shouldHideSnapByDefault = hasEvaluatedAnswer && !showSnapEvenIfEvaluated;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* INITIAL / LANDING HERO STATE (NO BOXES, ONLY QUERY SEARCH INPUT) */}
      {!hasSearched ? (
        <div className="mx-auto max-w-3xl pt-14 pb-20 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>DualMind FactForge</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Two Perspectives. <br />
            <span className="text-blue-400">One Verified Truth.</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Simultaneous multi-model generation cross-examined by an impartial arbiter.
          </p>

          {/* Simple, smooth input box (No neon / no shadow) */}
          <form onSubmit={handleSubmit} className="mt-7 relative">
            <div className="relative flex items-center rounded-xl border border-[#2E3340] bg-[#1C1F26] p-2 transition-all focus-within:border-blue-500">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything — get two perspectives, verified."
                className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Forge</span>
              </button>
            </div>
          </form>

          {/* Mode Segmented Controls & Options */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 max-w-2xl mx-auto">
            <div className="inline-flex rounded-lg bg-[#181A20] p-1 border border-[#262A35]">
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'auto'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Auto (With Judge AI)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'manual'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Manual (Raw Dual View)</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Preset: <strong className="text-slate-200">{activePreset.name}</strong></span>
              {tokenSaver && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-blue-400 font-medium">⚡ Token Saver ON</span>
                </>
              )}
            </div>
          </div>

          {/* Sample Prompts */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Suggested:</span>
            {SAMPLE_PROMPTS.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="text-slate-400 hover:text-slate-200 hover:bg-[#232731] px-2.5 py-1 rounded-md border border-[#2E3340] bg-[#1C1F26] transition-colors text-left truncate max-w-[280px]"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ACTIVE QUERY / SUBMITTED STATE */
        <div className="space-y-5">
          {/* Compact Top Query Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-[#2E3340] bg-[#1C1F26] p-2">
            <form onSubmit={handleSubmit} className="flex-1 flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask another question..."
                className="w-full bg-transparent px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!query.trim() || isPipelineGenerating}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
              >
                {isPipelineGenerating ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Ask</span>
              </button>
            </form>

            {/* Quick Status / Switcher Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-2 px-2 sm:px-0 border-t sm:border-t-0 sm:border-l border-[#262A35] pt-2 sm:pt-0 sm:pl-3">
              {(hasEvaluatedAnswer || (!isPrimaryLoading && primaryText)) && (
                <div className="inline-flex rounded-lg bg-[#181A20] p-0.5 border border-[#262A35]">
                  {mode === 'auto' && (
                    <button
                      type="button"
                      onClick={() => setActiveView('evaluated')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        activeView === 'evaluated'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Scale className="h-3 w-3" />
                      <span>Verified Verdict</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveView('dual')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeView === 'dual'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Columns className="h-3 w-3" />
                    <span>Side-by-Side Dual AI</span>
                  </button>
                </div>
              )}

              {/* Toggle to peek fast answer if hidden */}
              {hasEvaluatedAnswer && (
                <button
                  type="button"
                  onClick={() => setShowSnapEvenIfEvaluated(!showSnapEvenIfEvaluated)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded-md transition-colors"
                >
                  {showSnapEvenIfEvaluated ? (
                    <>
                      <EyeOff className="h-3 w-3" />
                      <span>Hide Fast Preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      <span>Show Fast Preview</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Yellow Warning Box */}
          {error && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <p>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => executeFactForge(submittedQuery || query)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-semibold text-xs shrink-0 hover:bg-amber-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* 1. FAST RESPONSE CARD */}
          {(!shouldHideSnapByDefault || isTokenSaverAwaiting || !hasEvaluatedAnswer) && (
            <div className="mx-auto max-w-4xl transition-all">
              <SnapCard
                text={snapText}
                isLoading={isSnapLoading}
                backgroundStatusMessage={backgroundStatus}
                isTokenSaverAwaiting={isTokenSaverAwaiting}
                onFactCheck={() => executeFactForge(submittedQuery || query, true)}
                onGoWithThis={() => setIsTokenSaverAwaiting(false)}
              />
            </div>
          )}

          {/* 2. PRIMARY VIEW: EVALUATED ANSWER (JUDGE AI VERDICT & SYNTHESIS) */}
          {activeView === 'evaluated' && mode === 'auto' && !activePreset.skipJudge && (
            <div className="mx-auto max-w-5xl transition-all">
              <JudgeVerdictCard
                verdict={judgeVerdict}
                isLoading={isJudgeLoading}
              />
            </div>
          )}

          {/* 3. SIDE-BY-SIDE DUAL AI VIEW (ChatGPT vs Claude) */}
          {(activeView === 'dual' || (mode === 'manual' && !isPrimaryLoading)) && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start transition-all">
              {/* Primary AI: ChatGPT */}
              <ResponsePanel
                id="primary"
                title="Primary AI (ChatGPT)"
                modelSubtitle="Model Alpha · Structured & Empirical Baseline"
                text={primaryText}
                isLoading={isPrimaryLoading}
                claims={mode === 'auto' ? judgeVerdict?.judgingData?.claims || [] : []}
                overallConfidence={mode === 'auto' ? judgeVerdict?.judgingData?.overallConfidence : undefined}
                overallStatus={mode === 'auto' ? overallVerdict : undefined}
                isExpanded={expandedPanel === 'primary'}
                onToggleExpand={() =>
                  setExpandedPanel(expandedPanel === 'primary' ? null : 'primary')
                }
                isOtherExpanded={expandedPanel === 'secondary'}
              />

              {/* Secondary AI: Claude */}
              <ResponsePanel
                id="secondary"
                title="Secondary AI (Claude)"
                modelSubtitle="Model Beta · Critical Lens & Nuanced Stress-Test"
                text={secondaryText}
                isLoading={isSecondaryLoading}
                claims={mode === 'auto' ? judgeVerdict?.judgingData?.claims || [] : []}
                overallConfidence={mode === 'auto' ? judgeVerdict?.judgingData?.overallConfidence : undefined}
                overallStatus={mode === 'auto' ? overallVerdict : undefined}
                isExpanded={expandedPanel === 'secondary'}
                onToggleExpand={() =>
                  setExpandedPanel(expandedPanel === 'secondary' ? null : 'secondary')
                }
                isOtherExpanded={expandedPanel === 'primary'}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
