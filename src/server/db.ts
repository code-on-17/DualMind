// Session-only in-memory storage — zero database or MongoDB requirements.
export interface ServerPreset {
  id: string;
  name: string;
  description: string;
  responseLength: 'concise' | 'balanced' | 'comprehensive';
  skipJudge: boolean;
  skipSnap: boolean;
  tonePrefix: string;
  isDefault?: boolean;
}

export function getStorageStatus() {
  return {
    mode: 'session-in-memory',
    description: '100% in-memory session architecture. No database or MongoDB keys required.',
  };
}
