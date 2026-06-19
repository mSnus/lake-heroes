import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { changeFame } from '../../utils/fame';
import { BattleResolution, BattleOutcome, logBattleSummary } from './common';

/**
 * Resolve a battle for a tile.
 * - Win on an unowned tile = CLAIM: attacker loses killed units, pays the
 *   level-1 gold price (units are already spent in the fight), and gains ownership.
 * - Win on an owned tile = RAZE: attacker loses killed units, ownership cleared, level reset.
 * - Defeat: attacker loses killed units, tile unchanged.
 * - Tie: no unit loss, no fee, tile drops a level (if above 1).
 * Defender's real units are never changed (static guards).
 */
export function resolveTileBattle(
  board: GameState,
  attacker: Player,
  defender: Player | undefined,
  tile: Tile,
  attackerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;
  const claiming = !tile.isOwned();

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    const lossStr = attackerUnitsKilled > 0 ? `, losing ${attackerUnitsKilled}🧍` : '';

    if (claiming) {
      attacker.gold -= tile.prices['1']?.gold ?? 0;
      tile.owner = attacker.id;
      attacker.ownedTiles.push(attacker.position);
      changeFame(attacker, 1);

      board.gameMessage = `${attacker.name} claims ${tile.name}${lossStr}!`;
      message = `${attacker.name} claims ${tile.name}${lossStr}!`;
      victoryBg = true;
    } else {
      board.players.forEach((p) => {
        p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
      });
      tile.owner = null;
      tile._level = 1;

      changeFame(attacker, 1);
      if (defender) changeFame(defender, -1);

      board.gameMessage = `${attacker.name} razed ${tile.name}${lossStr}!`;
      message = `${attacker.name} razes ${tile.name}${lossStr}!`;
      victoryBg = true;
    }
  } else if (outcome === 'defender') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    const lossStr = attackerUnitsKilled > 0 ? `, losing ${attackerUnitsKilled}🧍` : '';

    changeFame(attacker, -1);
    board.gameMessage = `${attacker.name} lost the battle for ${tile.name}${lossStr}`;
    message = `${attacker.name} retreats from ${tile.name}${lossStr}`;
    lostBg = true;
  } else {
    const unitLoss = Math.floor(tile.defence / 4);
    if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
    const lossStr = unitLoss > 0 ? `, losing ${unitLoss}🧍` : '';
    if (tile.level > 1) {
      tile._level = tile.level - 1;
      board.gameMessage = `${attacker.name}'s assault degraded ${tile.name} to level ${tile.level}${lossStr}`;
      message = `No fee paid and ${tile.name} degraded${lossStr}`;
    } else {
      board.gameMessage = `${attacker.name}'s assault on ${tile.name} ends in a stalemate${lossStr}`;
      message = `${attacker.name}'s army retreats${lossStr}`;
    }
  }

  logBattleSummary(
    attacker,
    defender ? defender.name : 'the guards',
    outcome,
    outcome === 'attacker' ? tile.name : null,
    unitsBefore,
    goldBefore
  );

  return { outcome, message, victoryBg, lostBg };
}
