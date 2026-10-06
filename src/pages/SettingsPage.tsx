import React, { useState } from 'react';
import {
  Cpu,
  Zap,
  Sliders,
  Plus,
  Trash2,
  Check,
  Info,
} from 'lucide-react';
import { useDualMind } from '../context/DualMindContext.tsx';
import { NeuralSyncLevel } from '../types/index.ts';

export const SettingsPage: React.FC = () => {
  const {
    neuralSync,
    setNeuralSync,
    tokenSaver,
    setTokenSaver,
    presets,
    activePresetId,
    setActivePresetId,
    createPreset,
    deletePreset,
    neuralContext,
    clearSessionContext,
  } = useDualMind();

  // New Preset Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLength, setNewLength] = useState<'concise' | 'balanced' | 'comprehensive'>('balanced');
  const [newSkipJudge, setNewSkipJudge] = useState(false);
  const [newSkipSnap, setNewSkipSnap] = useState(false);
  const [newTonePrefix, setNewTonePrefix] = useState('');

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await createPreset({
      name: newName.trim(),
      description: newDesc.trim() || 'Custom user configuration',
      responseLength: newLength,
      skipJudge: newSkipJudge,
      skipSnap: newSkipSnap,
      tonePrefix: newTonePrefix.trim(),
    });

    setIsModalOpen(false);
    setNewName('');
    setNewDesc('');
    setNewTonePrefix('');
    setNewSkipJudge(false);
    setNewSkipSnap(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          System <span className="text-blue-400">Settings</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Configure model context synthesis, token conservation, and response presets.
        </p>
      </div>

      {/* FEATURE 3: NeuralSync */}
      <section className="rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5">
        <div className="flex items-center gap-3 pb-3.5 border-b border-[#262A35]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              NeuralSync (Context Handoff)
            </h2>
            <p className="text-xs text-slate-400">
              Session-only cross-model context synthesis for follow-up questions.
            </p>
          </div>
        </div>

        {/* 3-Option Segmented Control */}
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1 rounded-lg bg-[#181A20] border border-[#262A35]">
            {(['off', 'smart', 'full'] as NeuralSyncLevel[]).map((level) => {
              const isActive = neuralSync === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setNeuralSync(level)}
                  className={`flex flex-col items-center text-center p-3 rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#232731]'
                  }`}
                >
                  <span className="text-xs font-bold capitalize">
                    {level}
                  </span>
                  <span
                    className={`mt-1 text-[11px] leading-snug ${
                      isActive ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {level === 'off' &&
                      'Model conversation histories remain completely independent.'}
                    {level === 'smart' &&
                      'Summarizes and injects context on factual or technical topics.'}
                    {level === 'full' &&
                      'Unconditionally summarizes and carries context after every exchange.'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-[#232731] p-3 rounded-lg border border-[#2E3340]">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400 shrink-0" />
              <span>
                <strong>Session-Only Policy:</strong> Context is strictly kept in active memory. Nothing is persisted after your session ends.
              </span>
            </div>

            {neuralContext && (
              <button
                type="button"
                onClick={clearSessionContext}
                className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 bg-[#1C1F26] hover:bg-[#2A2F3D] hover:text-white border border-[#2E3340] transition-colors"
              >
                Clear Memory
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FEATURE 5: Token Saver */}
      <section className="rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Token Saver
                {tokenSaver && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Conserves API tokens by gating full dual-AI and judge calls behind an instant fast preview.
              </p>
            </div>
          </div>

          {/* Clean Toggle Switch */}
          <button
            type="button"
            onClick={() => setTokenSaver(!tokenSaver)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              tokenSaver ? 'bg-blue-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                tokenSaver ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div
            className={`p-3.5 rounded-lg border transition-colors ${
              !tokenSaver
                ? 'border-blue-500/40 bg-blue-500/10 text-slate-200'
                : 'border-[#2E3340] bg-[#232731] text-slate-400'
            }`}
          >
            <strong className="block text-xs font-semibold text-white mb-1">OFF (Parallel Stream)</strong>
            Fast preview and the dual AI pipeline run in parallel on query submission for immediate depth.
          </div>

          <div
            className={`p-3.5 rounded-lg border transition-colors ${
              tokenSaver
                ? 'border-blue-500/40 bg-blue-500/10 text-slate-200'
                : 'border-[#2E3340] bg-[#232731] text-slate-400'
            }`}
          >
            <strong className="block text-xs font-semibold text-white mb-1">ON (Preview Gated)</strong>
            Only the fast preview runs first. You decide whether to escalate via <em>"Fact Check"</em> or conclude via <em>"Go with this"</em>.
          </div>
        </div>
      </section>

      {/* FEATURE 6: Presets */}
      <section className="rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#262A35]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sliders className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Pipeline Presets
              </h2>
              <p className="text-xs text-slate-400">
                Adjust response length, tone, and pipeline verification depth.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Preset</span>
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {presets.map((preset) => {
            const isSelected = activePresetId === preset.id;

            return (
              <div
                key={preset.id}
                onClick={() => setActivePresetId(preset.id)}
                className={`relative flex flex-col justify-between cursor-pointer rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-[#2E3340] bg-[#232731] hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      {preset.name}
                      {isSelected && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </span>
                    {!preset.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset(preset.id);
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Delete preset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {preset.description}
                  </p>
                </div>

                <div className="space-y-1 text-[11px] text-slate-400 border-t border-[#262A35] pt-2.5">
                  <div className="flex justify-between">
                    <span>Length:</span>
                    <span className="capitalize text-slate-200">{preset.responseLength}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Judge Pass:</span>
                    <span className={preset.skipJudge ? 'text-amber-400' : 'text-emerald-400'}>
                      {preset.skipJudge ? 'Bypassed' : 'Enabled'}
                    </span>
                  </div>
                  {preset.tonePrefix && (
                    <div className="truncate">
                      <span className="text-slate-500">Tone: </span>
                      <span className="text-slate-300">{preset.tonePrefix}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* New Preset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#2E3340] bg-[#1C1F26] p-5 shadow-xl">
            <h3 className="text-base font-bold text-white mb-3.5">
              Create Custom Preset
            </h3>

            <form onSubmit={handleCreatePreset} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Preset Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Fast Fact, Technical Audit"
                  className="w-full rounded-lg border border-[#2E3340] bg-[#232731] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of when to use this preset"
                  className="w-full rounded-lg border border-[#2E3340] bg-[#232731] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Response Depth
                </label>
                <select
                  value={newLength}
                  onChange={(e: any) => setNewLength(e.target.value)}
                  className="w-full rounded-lg border border-[#2E3340] bg-[#232731] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="concise">Concise (&lt; 250 words)</option>
                  <option value="balanced">Balanced</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tone Directive
                </label>
                <input
                  type="text"
                  value={newTonePrefix}
                  onChange={(e) => setNewTonePrefix(e.target.value)}
                  placeholder="e.g., 'Emphasize mathematical rigor.'"
                  className="w-full rounded-lg border border-[#2E3340] bg-[#232731] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#262A35]">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSkipJudge}
                    onChange={(e) => setNewSkipJudge(e.target.checked)}
                    className="rounded border-[#2E3340] bg-[#232731] text-blue-500 focus:ring-0"
                  />
                  <span>Skip Judge AI verification pass (faster output)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSkipSnap}
                    onChange={(e) => setNewSkipSnap(e.target.checked)}
                    className="rounded border-[#2E3340] bg-[#232731] text-blue-500 focus:ring-0"
                  />
                  <span>Skip instant preview</span>
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
