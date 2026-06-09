import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { changeFame } from '../../utils/fame';
import {
  BattleResolution,
  RoundResult,
  determineBattleOutcome,
  logBattleSummary,
  perRoundUnitLoss,
} from './common';

/**
 * Resolve a battle for a tile. The attacker loses per-round units on every
 * outcome.
 * - Win = RAZE: ownership cleared, level reset (the attacker can buy it after),
 *   attacker fame +1, defender fame −1.
 * - Defeat: attacker fame −1.
 * - Tie: no fee; the defender's tile drops a level (if above 1).
 */
export function resolveTileBattle(
  board: GameState,
  attacker: Player,
  defender: Player | undefined,
  tile: Tile,
  defence: number,
  totalRounds: number,
  results: RoundResult[]
): BattleResolution {
  const outcome = determineBattleOutcome(results);
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;

  const unitLoss = perRoundUnitLoss(defence, totalRounds, results);
  const lossStr = unitLoss > 0 ? `, losing ${unitLoss}🧍` : '';
  attacker.units = Math.max(0, attacker.units - unitLoss);

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
    });
    tile.owner = null;
    tile._level = 1;

    changeFame(attacker, 1);
    if (defender) changeFame(defender, -1);

    board.gameMessage = `${attacker.name} razed ${tile.name} to the ground${lossStr}! The land lies open to claim.`;
    message = `${attacker.name} razes ${tile.name}${lossStr}! Claim the open land now.`;
    victoryBg = true;
  } else if (outcome === 'defender') {
    changeFame(attacker, -1);
    board.gameMessage = `${attacker.name} lost the battle for ${tile.name}${lossStr}`;
    message = `${attacker.name} retreats from ${tile.name}${lossStr}`;
  } else {
    if (tile.level > 1) {
      tile._level = tile.level - 1;
      board.gameMessage = `${attacker.name}'s assault degraded ${tile.name} to level ${tile.level}${lossStr}`;
      message = `No fee paid and ${tile.name} degraded${lossStr}`;
    } else {
      board.gameMessage = `${attacker.name}'s army retreats${lossStr}`;
      message = `${attacker.name}'s army retreats${lossStr}`;
    }
    if (unitLoss > 0) lostBg = true;
  }

  logBattleSummary(
    attacker,
    defender ? defender.name : 'the guards',
    outcome,
    tile.name,
    unitsBefore,
    goldBefore
  );

  return { outcome, message, victoryBg, lostBg };
}
