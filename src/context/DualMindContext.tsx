import React, { createContext, useContext, useState, useEffect } from 'react';
import { NeuralSyncLevel, Preset } from '../types/index.ts';

interface DualMindContextType {
  neuralSync: NeuralSyncLevel;
  setNeuralSync: (level: NeuralSyncLevel) => void;
  tokenSaver: boolean;
  setTokenSaver: (active: boolean) => void;
  activePresetId: string;
  setActivePresetId: (id: string) => void;
  presets: Preset[];
  activePreset: Preset;
  neuralContext: string;
  setNeuralContext: React.Dispatch<React.SetStateAction<string>>;
  clearSessionContext: () => void;
  createPreset: (preset: Omit<Preset, 'id' | 'isDefault'>) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;
  systemStatus: {
    geminiKeyConfigured: boolean;
    openaiKeyConfigured: boolean;
    anthropicKeyConfigured: boolean;
    status: string;
  };
  refreshSystemStatus: () => Promise<void>;
}

const DualMindContext = createContext<DualMindContextType | undefined>(undefined);

export const DualMindProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [neuralSync, setNeuralSyncState] = useState<NeuralSyncLevel>(() => {
    return (sessionStorage.getItem('dualmind_neuralsync') as NeuralSyncLevel) || 'off';
  });

  const [tokenSaver, setTokenSaverState] = useState<boolean>(() => {
    return localStorage.getItem('dualmind_tokensaver') === 'true';
  });

  const [activePresetId, setActivePresetIdState] = useState<string>(() => {
    return localStorage.getItem('dualmind_active_preset') || 'deep';
  });

  const [presets, setPresets] = useState<Preset[]>([
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
  ]);

  const [neuralContext, setNeuralContext] = useState<string>('');

  const [systemStatus, setSystemStatus] = useState({
    geminiKeyConfigured: false,
    openaiKeyConfigured: false,
    anthropicKeyConfigured: false,
    status: 'checking',
  });

  const setNeuralSync = (level: NeuralSyncLevel) => {
    setNeuralSyncState(level);
    sessionStorage.setItem('dualmind_neuralsync', level);
  };

  const setTokenSaver = (active: boolean) => {
    setTokenSaverState(active);
    localStorage.setItem('dualmind_tokensaver', String(active));
  };

  const setActivePresetId = (id: string) => {
    setActivePresetIdState(id);
    localStorage.setItem('dualmind_active_preset', id);
  };

  const clearSessionContext = () => {
    setNeuralContext('');
  };

  const refreshSystemStatus = async () => {
    try {
      const res = await fetch('/api/system-status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch {
      // Offline fallback
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPresets(data);
        }
      }
    } catch {
      // Use defaults
    }
  };

  useEffect(() => {
    refreshSystemStatus();
    fetchPresets();
  }, []);

  const createPreset = async (presetData: Omit<Preset, 'id' | 'isDefault'>): Promise<Preset> => {
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presetData),
      });
      if (res.ok) {
        const saved = await res.json();
        setPresets(prev => [...prev, saved]);
        setActivePresetId(saved.id);
        return saved;
      }
    } catch (err) {
      console.warn('Fallback saving preset locally', err);
    }

    const localPreset: Preset = {
      ...presetData,
      id: 'local-' + Date.now(),
      isDefault: false,
    };
    setPresets(prev => [...prev, localPreset]);
    setActivePresetId(localPreset.id);
    return localPreset;
  };

  const deletePreset = async (id: string) => {
    try {
      await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    } catch {}
    setPresets(prev => prev.filter(p => p.id !== id));
    if (activePresetId === id) {
      setActivePresetId('deep');
    }
  };

  const activePreset = presets.find(p => p.id === activePresetId) || presets[1] || presets[0];

  return (
    <DualMindContext.Provider
      value={{
        neuralSync,
        setNeuralSync,
        tokenSaver,
        setTokenSaver,
        activePresetId,
        setActivePresetId,
        presets,
        activePreset,
        neuralContext,
        setNeuralContext,
        clearSessionContext,
        createPreset,
        deletePreset,
        systemStatus,
        refreshSystemStatus,
      }}
    >
      {children}
    </DualMindContext.Provider>
  );
};

export const useDualMind = () => {
  const context = useContext(DualMindContext);
  if (!context) {
    throw new Error('useDualMind must be used within a DualMindProvider');
  }
  return context;
};
