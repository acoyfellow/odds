import type { OddsAnswer, OddsQuestion } from '../../src/client.ts';

export interface DemoRow {
  id: string;
  title: string;
  answers: Record<string, OddsAnswer>;
}

export interface DemoRecording {
  model: string;
  recordedAt: string;
  elapsedMs: number;
  inputTokens: number;
  costUsd: number;
  frontierInputTokensEstimate: number;
  questions: Record<string, OddsQuestion>;
  rows: DemoRow[];
}
