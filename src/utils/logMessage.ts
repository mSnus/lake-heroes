import type { SayLevel } from './say';

/** One line of the game log (see App.tsx and the log drawer). */
export interface LogMessage {
  message: string;
  level: SayLevel;
  timestamp: number;
  /** Same topic and actor as the previous line: merged into it (see App.tsx). */
  topic?: string;
  actor?: string;
}
