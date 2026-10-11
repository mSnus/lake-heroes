import { GameState } from './GameState';
import { Player } from './Player';
import { playerScore } from './score';

export interface PlayerTurnStat {
  playerId: number;
  turn: number;
  /** Same figure Kingdom Overview shows with ⭐ -- see game/score.ts. */
  power: number;
}

export type StatEventType =
  | 'sphynx'
  | 'joker'
  | 'battle-won'
  | 'battle-lost'
  | 'treasure'
  | 'promotion'
  | 'dragon'
  | 'kings-castle';

export interface PlayerStatEvent {
  playerId: number;
  turn: number;
  type: StatEventType;
  /** Only set for battle-won/battle-lost: the other side's display name. */
  opponentName?: string;
}

/** Snapshots one player's stats for the turn that just ended. Call once per
 * player, right as their turn concludes (see endTurn.ts). */
export function recordTurnStat(board: GameState, player: Player): void {
  board.turnStats.push({
    playerId: player.id,
    turn: board.turns,
    power: playerScore(board, player),
  });
}

export function recordStatEvent(
  board: GameState,
  player: Player,
  type: StatEventType,
  opponentName?: string
): void {
  board.statEvents.push({ playerId: player.id, turn: board.turns, type, opponentName });
}
