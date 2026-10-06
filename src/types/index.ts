export type FactStatus = 'verified' | 'disputed' | 'unverifiable';

export interface ClaimHighlight {
  text: string;
  status: FactStatus;
  confidence: number;
  reason: string;
}

export interface JudgingData {
  claims: ClaimHighlight[];
  overallConfidence: number;
}

export interface JudgeVerdict {
  judgingData: JudgingData;
  response: string; // Markdown summary
}

export type PipelineMode = 'auto' | 'manual';

export type NeuralSyncLevel = 'off' | 'smart' | 'full';

export interface Preset {
  id: string;
  name: string;
  description: string;
  responseLength: 'concise' | 'balanced' | 'comprehensive';
  skipJudge: boolean;
  skipSnap: boolean;
  tonePrefix: string;
  isDefault?: boolean;
}

export interface FactForgeState {
  query: string;
  mode: PipelineMode;
  snapText: string;
  isSnapLoading: boolean;
  isSnapComplete: boolean;
  primaryText: string;
  isPrimaryLoading: boolean;
  secondaryText: string;
  isSecondaryLoading: boolean;
  judgeVerdict: JudgeVerdict | null;
  isJudgeLoading: boolean;
  error: string | null;
  activePresetId: string;
  tokenSaverActive: boolean;
  tokenSaverAwaitingConfirm: boolean;
}

export interface IdeaClashMessage {
  id: string;
  round: number;
  speaker: 'alpha' | 'beta';
  speakerName: string;
  stance: string;
  content: string;
  isStreaming?: boolean;
  timestamp: number;
}

export interface IdeaClashSession {
  topic: string;
  currentRound: number;
  totalRounds: number;
  status: 'idle' | 'debating' | 'completed' | 'error';
  messages: IdeaClashMessage[];
  alphaStance: string;
  betaStance: string;
  finalVerdict?: string;
  error?: string;
}
