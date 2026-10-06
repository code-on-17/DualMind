import React, { useState } from 'react';
import { Maximize2, Minimize2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { ClaimHighlight } from '../types/index.ts';

interface ResponsePanelProps {
  id: 'primary' | 'secondary';
  title: string;
  modelSubtitle: string;
  text: string;
  isLoading: boolean;
  claims: ClaimHighlight[];
  overallConfidence?: number;
  overallStatus?: 'Verified' | 'Disputed' | 'Mixed';
  isExpanded: boolean;
  onToggleExpand: () => void;
  isOtherExpanded: boolean;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  title,
  modelSubtitle,
  text,
  isLoading,
  claims = [],
  overallConfidence,
  overallStatus,
  isExpanded,
  onToggleExpand,
  isOtherExpanded,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);

  if (isOtherExpanded && !isExpanded) {
    return null;
  }

  const getBadgeConfig = (status?: string) => {
    switch (status) {
      case 'Verified':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: CheckCircle2,
          label: 'Verified',
        };
      case 'Disputed':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: AlertTriangle,
          label: 'Disputed',
        };
      case 'Mixed':
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          icon: HelpCircle,
          label: 'Mixed',
        };
      default:
        return null;
    }
  };

  const badgeConfig = getBadgeConfig(overallStatus);

  const renderHighlightedContent = () => {
    if (!text) {
      return (
        <div className="flex h-40 items-center justify-center text-slate-500 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
              <span>Generating response...</span>
            </div>
          ) : (
            'Enter a query to view model perspective.'
          )}
        </div>
      );
    }

    if (claims.length === 0 || isLoading) {
      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
          {text}
          {isLoading && (
            <span className="inline-block h-3.5 w-1.5 ml-1 bg-blue-400 animate-pulse"></span>
          )}
        </div>
      );
    }

    const claimMatches: { start: number; end: number; claim: ClaimHighlight; claimIndex: number }[] = [];
    const lowerText = text.toLowerCase();

    claims.forEach((claim, idx) => {
      if (!claim.text || claim.text.length < 5) return;
      const cleanClaim = claim.text.trim().toLowerCase();
      let pos = lowerText.indexOf(cleanClaim);
      if (pos === -1 && cleanClaim.length > 25) {
        pos = lowerText.indexOf(cleanClaim.slice(0, 25));
      }

      if (pos !== -1) {
        const matchLength = Math.min(claim.text.length, text.length - pos);
        claimMatches.push({
          start: pos,
          end: pos + matchLength,
          claim,
          claimIndex: idx,
        });
      }
    });

    claimMatches.sort((a, b) => a.start - b.start);

    if (claimMatches.length === 0) {
      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
          {text}
        </div>
      );
    }

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    claimMatches.forEach((match, i) => {
      if (match.start < lastIndex) return;

      if (match.start > lastIndex) {
        segments.push(
          <span key={`text-${i}`}>{text.substring(lastIndex, match.start)}</span>
        );
      }

      const statusColor =
        match.claim.status === 'verified'
          ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500'
          : match.claim.status === 'disputed'
          ? 'bg-amber-500/15 text-amber-300 border-b border-amber-500'
          : 'bg-slate-800 text-slate-300 border-b border-slate-600';

      const isTooltipActive = activeTooltipIndex === match.claimIndex;

      segments.push(
        <span
          key={`claim-${i}`}
          className={`relative group inline cursor-pointer px-1 py-0.5 rounded transition-colors ${statusColor}`}
          onClick={() => setActiveTooltipIndex(isTooltipActive ? null : match.claimIndex)}
          onMouseEnter={() => setActiveTooltipIndex(match.claimIndex)}
          onMouseLeave={() => setActiveTooltipIndex(null)}
        >
          {text.substring(match.start, match.end)}

          {isTooltipActive && (
            <div className="absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-lg border border-[#2E3340] bg-[#21252E] p-3 text-xs shadow-xl">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#2E3340]">
                <span className="font-semibold capitalize text-slate-200">
                  {match.claim.status} Claim
                </span>
                <span className="text-[11px] font-mono text-blue-400">
                  {Math.round(match.claim.confidence * 100)}% Confidence
                </span>
              </div>
              <p className="mt-1.5 text-slate-300 leading-snug font-normal">
                {match.claim.reason}
              </p>
            </div>
          )}
        </span>
      );

      lastIndex = match.end;
    });

    if (lastIndex < text.length) {
      segments.push(
        <span key="text-end">{text.substring(lastIndex)}</span>
      );
    }

    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
        {segments}
      </div>
    );
  };

  return (
    <div
      className={`relative flex flex-col rounded-xl border border-[#2E3340] bg-[#1C1F26] transition-all ${
        isExpanded
          ? 'fixed inset-4 z-40 overflow-y-auto max-h-[calc(100vh-2rem)] border-blue-500/50'
          : 'w-full min-h-[360px]'
      }`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#262A35] px-4.5 py-3.5 bg-[#181A20] rounded-t-xl">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              {title}
            </h3>
            {isLoading && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">{modelSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {badgeConfig && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${badgeConfig.bg}`}
            >
              <badgeConfig.icon className="h-3 w-3" />
              <span>{badgeConfig.label}</span>
            </div>
          )}

          {typeof overallConfidence === 'number' && (
            <span className="text-xs font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              {Math.round(overallConfidence * 100)}%
            </span>
          )}

          <button
            type="button"
            onClick={onToggleExpand}
            title={isExpanded ? 'Collapse' : 'Expand full width'}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-white hover:bg-[#232731] border border-[#2E3340] transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5 text-blue-400" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-4.5 overflow-y-auto">
        {renderHighlightedContent()}
      </div>

      {/* Expandable Details */}
      {claims.length > 0 && (
        <div className="border-t border-[#262A35] bg-[#181A20] rounded-b-xl">
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span>Verification Details</span>
              <span className="text-slate-500 font-mono">({claims.length})</span>
            </span>
            {detailsOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-blue-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {detailsOpen && (
            <div className="space-y-2 px-4 pb-3 pt-1">
              {claims.map((claim, idx) => {
                const statusBorder =
                  claim.status === 'verified'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : claim.status === 'disputed'
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-slate-800 bg-[#21252E]';

                const statusText =
                  claim.status === 'verified'
                    ? 'text-emerald-400'
                    : claim.status === 'disputed'
                    ? 'text-amber-400'
                    : 'text-slate-400';

                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-2.5 text-xs ${statusBorder}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-200">
                        "{claim.text}"
                      </p>
                      <span className={`font-semibold uppercase tracking-wider shrink-0 text-[10px] ${statusText}`}>
                        {claim.status} · {Math.round(claim.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-1 text-slate-400 leading-relaxed text-[11px]">
                      {claim.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
