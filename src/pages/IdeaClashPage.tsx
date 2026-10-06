import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Swords,
  Volume2,
  VolumeX,
  RefreshCw,
  Award,
  Scale,
  AlertCircle,
} from 'lucide-react';
import { IdeaClashMessage } from '../types/index.ts';

const SAMPLE_TOPICS = [
  'Universal Basic Income vs Direct Government Job Guarantees',
  'Is Monolithic Architecture fundamentally superior to Microservices for startups?',
  'Should Artificial General Intelligence development be strictly restricted to air-gapped facilities?',
  'Nuclear Fission vs Distributed Battery Storage for decarbonizing heavy industry',
];

export const IdeaClashPage: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [isDebating, setIsDebating] = useState(false);
  const [messages, setMessages] = useState<IdeaClashMessage[]>([]);
  const [alphaStance, setAlphaStance] = useState('');
  const [betaStance, setBetaStance] = useState('');
  const [finalVerdict, setFinalVerdict] = useState<string | null>(null);
  const [isVerdictLoading, setIsVerdictLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Web Speech API state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const activeAbortController = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, finalVerdict]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = (msgId: string, text: string, speaker: 'alpha' | 'beta') => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = speaker === 'alpha' ? 1.05 : 0.95;
    utterance.rate = 1.05;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const startDebate = async (targetTopic: string) => {
    if (!targetTopic.trim()) return;

    if (activeAbortController.current) {
      activeAbortController.current.abort();
    }
    const abortController = new AbortController();
    activeAbortController.current = abortController;

    setError(null);
    setIsDebating(true);
    setMessages([]);
    setCurrentRound(1);
    setFinalVerdict(null);
    setIsVerdictLoading(false);

    try {
      const response = await fetch('/api/idea-clash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          topic: targetTopic,
          rounds: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Stream reader unavailable');

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
            case 'debate_setup':
              setTotalRounds(payload.totalRounds || 5);
              setAlphaStance(payload.alphaStance || '');
              setBetaStance(payload.betaStance || '');
              break;

            case 'turn_start':
              setCurrentRound(payload.round);
              setMessages((prev) => [
                ...prev,
                {
                  id: `round-${payload.round}-${payload.speaker}`,
                  round: payload.round,
                  speaker: payload.speaker,
                  speakerName: payload.speakerName,
                  stance: payload.speaker === 'alpha' ? alphaStance : betaStance,
                  content: '',
                  isStreaming: true,
                  timestamp: Date.now(),
                },
              ]);
              break;

            case 'turn_chunk':
              setMessages((prev) => {
                const targetId = `round-${payload.round}-${payload.speaker}`;
                return prev.map((m) => {
                  if (m.id === targetId) {
                    return { ...m, content: m.content + (payload.chunk || '') };
                  }
                  return m;
                });
              });
              break;

            case 'turn_done':
              setMessages((prev) => {
                const targetId = `round-${payload.round}-${payload.speaker}`;
                return prev.map((m) => {
                  if (m.id === targetId) {
                    return { ...m, content: payload.fullText || m.content, isStreaming: false };
                  }
                  return m;
                });
              });
              break;

            case 'verdict_start':
              setIsVerdictLoading(true);
              break;

            case 'clash_verdict':
              setFinalVerdict(payload.verdict || '');
              setIsVerdictLoading(false);
              break;

            case 'error':
              setError(payload.message || 'Idea Clash execution error');
              setIsDebating(false);
              setIsVerdictLoading(false);
              break;

            case 'done':
              setIsDebating(false);
              setIsVerdictLoading(false);
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to stream Idea Clash');
      }
    } finally {
      setIsDebating(false);
      setIsVerdictLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startDebate(topic);
  };

  const handleSelectSample = (sample: string) => {
    setTopic(sample);
    startDebate(sample);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
          <Swords className="h-3.5 w-3.5" />
          <span>Idea Clash Arena</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Autonomous <span className="text-blue-400">AI Debate</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
          Fast-paced, concise dialectical cross-examination across 5 rounds.
        </p>

        {/* Topic Input Bar */}
        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl mx-auto">
          <div className="relative flex items-center rounded-xl border border-[#2E3340] bg-[#1C1F26] p-2 focus-within:border-blue-500 transition-colors">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter debate topic (e.g., 'Monoliths vs Microservices')..."
              className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!topic.trim() || isDebating}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
            >
              {isDebating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Swords className="h-4 w-4" />
              )}
              <span>Clash</span>
            </button>
          </div>
        </form>

        {/* Sample Topics */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Debate Topics:</span>
          {SAMPLE_TOPICS.map((sample, idx) => (
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

      {/* Yellow Warning Box */}
      {error && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => startDebate(topic)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-slate-900 font-semibold text-xs shrink-0 hover:bg-amber-400 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Debate Session Status Bar */}
      {(isDebating || messages.length > 0) && (
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-[#2E3340] bg-[#1C1F26] px-4 py-3">
          {/* Round Indicator */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-white">
              Round {currentRound} of {totalRounds}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalRounds }).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx + 1 < currentRound
                      ? 'w-4 bg-blue-500'
                      : idx + 1 === currentRound
                      ? 'w-6 bg-blue-400 animate-pulse'
                      : 'w-2 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-400"></span>
              Model Alpha (Affirmative)
            </span>
            <span aria-hidden="true" className="text-slate-600">vs</span>
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              Model Beta (Critical)
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">Judge: <strong className="text-slate-200">Gemini</strong></span>
          </div>
        </div>
      )}

      {/* Debate Thread */}
      <div className="mt-5 space-y-3.5">
        {messages.map((msg) => {
          const isAlpha = msg.speaker === 'alpha';
          const isSpeaking = speakingMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col rounded-xl border p-4 transition-all ${
                isAlpha
                  ? 'border-blue-500/25 bg-[#1C1F26] ml-0 mr-auto sm:max-w-[85%]'
                  : 'border-emerald-500/25 bg-[#1C1F26] mr-0 ml-auto sm:max-w-[85%]'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#262A35]">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                      isAlpha
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isAlpha ? 'α' : 'β'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">
                      {msg.speakerName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Round {msg.round}
                    </span>
                  </div>
                </div>

                {/* Voice / TTS button (Web Speech API) */}
                <button
                  type="button"
                  onClick={() => handleSpeak(msg.id, msg.content, msg.speaker)}
                  title={isSpeaking ? 'Mute' : 'Speak Turn'}
                  className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                    isSpeaking
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : 'border-[#2E3340] text-slate-400 hover:text-white hover:bg-[#232731]'
                  }`}
                >
                  {isSpeaking ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Message Content */}
              <div className="pt-2.5 text-sm leading-relaxed text-slate-200">
                {msg.content || (
                  <span className="inline-block animate-pulse text-slate-500 text-xs">
                    Composing rebuttal...
                  </span>
                )}
                {msg.isStreaming && (
                  <span className="inline-block h-3.5 w-1.5 ml-1 bg-blue-400 animate-pulse"></span>
                )}
              </div>
            </div>
          );
        })}

        {/* Verdict Loading state */}
        {isVerdictLoading && (
          <div className="rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5 text-center">
            <Scale className="h-5 w-5 text-blue-400 animate-pulse mx-auto mb-1.5" />
            <h4 className="text-sm font-semibold text-white">
              Arbiter Synthesizing Final Decision
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyzing debate argumentation and scoring key clash dimensions...
            </p>
          </div>
        )}

        {/* Final Debate Verdict Card */}
        {finalVerdict && (
          <div className="mt-6 rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5 sm:p-6 transition-all">
            <div className="flex items-center gap-2.5 border-b border-[#262A35] pb-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Award className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Judge AI Debate Synthesis & Verdict
                </h3>
                <p className="text-xs text-slate-400">
                  Comprehensive clash scoring and strategic reconciliation
                </p>
              </div>
            </div>

            <div className="mt-4 prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed prose-headings:text-white prose-headings:font-semibold prose-h3:text-sm prose-h4:text-xs prose-p:my-2 prose-ul:my-2 prose-strong:text-blue-300">
              <ReactMarkdown>{finalVerdict}</ReactMarkdown>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
