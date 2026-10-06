import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Scale, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { JudgeVerdict } from '../types/index.ts';

interface JudgeVerdictCardProps {
  verdict: JudgeVerdict | null;
  isLoading: boolean;
}

export const JudgeVerdictCard: React.FC<JudgeVerdictCardProps> = ({ verdict, isLoading }) => {
  if (!verdict && !isLoading) return null;

  if (isLoading) {
    return (
      <div className="mt-6 rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Scale className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              Evaluating & Cross-Examining Perspectives
              <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
            </h4>
            <p className="text-xs text-slate-400">
              Impartially synthesizing claims against empirical baseline...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!verdict) return null;

  const claims = verdict.judgingData.claims || [];
  const verifiedCount = claims.filter(c => c.status === 'verified').length;
  const disputedCount = claims.filter(c => c.status === 'disputed').length;
  const unverifiableCount = claims.filter(c => c.status === 'unverifiable').length;
  const confidencePercent = Math.round(verdict.judgingData.overallConfidence * 100);

  return (
    <div className="mt-6 rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5 sm:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262A35] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Scale className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Verified Verdict & Synthesis
            </h3>
            <p className="text-xs text-slate-400">
              Objective cross-model evaluation and consensus analysis
            </p>
          </div>
        </div>

        {/* Claim breakdown metric badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
            <span className="font-mono text-blue-400 font-semibold">{confidencePercent}%</span>
            <span>Confidence</span>
          </div>

          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            <span>{verifiedCount} Verified</span>
          </div>

          {disputedCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              <span>{disputedCount} Disputed</span>
            </div>
          )}

          {unverifiableCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#232731] border border-[#2E3340] text-slate-400 font-medium">
              <HelpCircle className="h-3 w-3" />
              <span>{unverifiableCount} Unverifiable</span>
            </div>
          )}
        </div>
      </div>

      {/* Markdown formatted response */}
      <div className="mt-4 prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed prose-headings:text-white prose-headings:font-semibold prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-strong:text-blue-300 prose-code:text-blue-300 prose-code:bg-[#232731] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
        <ReactMarkdown>{verdict.response}</ReactMarkdown>
      </div>
    </div>
  );
};
