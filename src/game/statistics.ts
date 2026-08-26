import { GameState } from './GameState';
import { Player } from './Player';
import { playerWealth } from './wealth';

export interface PlayerTurnStat {
  playerId: number;
  turn: number;
  wealth: number;
  units: number;
  fame: number;
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

/** Raw headcount (militia + riders, each counted as 1) across a player's
 * traveling army and every tile garrison they own. Deliberately NOT
 * armyPower-weighted -- this is a headcount stat, not a combat-strength one. */
function computeUnitsHeadcount(board: GameState, player: Player): number {
  let units = player.militia + player.riders;
  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile) continue;
    units += tile.garrisonMilitia + tile.garrisonRiders;
  }

  return units;
}

/** Snapshots one player's stats for the turn that just ended. Call once per
 * player, right as their turn concludes (see endTurn.ts). */
export function recordTurnStat(board: GameState, player: Player): void {
  board.turnStats.push({
    playerId: player.id,
    turn: board.turns,
    wealth: playerWealth(board, player).gold,
    units: computeUnitsHeadcount(board, player),
    fame: player.fame,
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
