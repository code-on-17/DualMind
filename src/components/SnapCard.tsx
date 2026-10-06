import React from 'react';
import { Zap, ShieldCheck, Check, Cpu } from 'lucide-react';

interface SnapCardProps {
  text: string;
  isLoading: boolean;
  backgroundStatusMessage?: string | null;
  isTokenSaverAwaiting: boolean;
  onFactCheck: () => void;
  onGoWithThis: () => void;
}

export const SnapCard: React.FC<SnapCardProps> = ({
  text,
  isLoading,
  backgroundStatusMessage,
  isTokenSaverAwaiting,
  onFactCheck,
  onGoWithThis,
}) => {
  if (!text && !isLoading) return null;

  return (
    <div className="relative rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5 transition-all">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Fast Preview
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-400">
              {isLoading ? 'Synthesizing...' : 'Preliminary Assessment'}
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
              <span className="text-[11px]">Streaming</span>
            </div>
          )}
        </div>

        {/* Text body */}
        <p className="text-sm leading-relaxed text-slate-200">
          {text || (
            <span className="inline-block animate-pulse text-slate-500">
              Generating immediate preliminary assessment...
            </span>
          )}
        </p>

        {/* Live background pipeline activity line */}
        {backgroundStatusMessage && !isTokenSaverAwaiting && (
          <div className="mt-1 flex items-center gap-2.5 rounded-lg bg-[#232731] border border-[#2E3340] px-3.5 py-2 text-xs text-blue-300">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-blue-400 animate-pulse" />
            <span className="font-medium tracking-wide">{backgroundStatusMessage}</span>
          </div>
        )}

        {/* Token Saver Action Buttons */}
        {isTokenSaverAwaiting && !isLoading && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#2E3340] pt-3">
            <span className="text-xs text-amber-300">
              ⚡ Token Saver active. Choose next step:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onGoWithThis}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-[#232731] hover:bg-[#2A2F3D] hover:text-white border border-[#2E3340] transition-colors"
              >
                <Check className="h-3.5 w-3.5 text-slate-400" />
                <span>Go with this</span>
              </button>

              <button
                type="button"
                onClick={onFactCheck}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-blue-100" />
                <span>Escalate to Fact Check</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
