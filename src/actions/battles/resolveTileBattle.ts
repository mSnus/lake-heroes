import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { changeFame } from '../../utils/fame';
import { BattleResolution, BattleOutcome, logBattleSummary } from './common';

/**
 * Resolve a battle for a tile.
 * - Win = RAZE: attacker loses killed units, ownership cleared, level reset.
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

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    const lossStr = attackerUnitsKilled > 0 ? `, losing ${attackerUnitsKilled}🧍` : '';

    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
    });
    tile.owner = null;
    tile._level = 1;

    changeFame(attacker, 1);
    if (defender) changeFame(defender, -1);

    board.gameMessage = `${attacker.name} razed ${tile.name}${lossStr} and now could claim it.`;
    message = `${attacker.name} razes ${tile.name}${lossStr}!`;
    victoryBg = true;
  } else if (outcome === 'defender') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    const lossStr = attackerUnitsKilled > 0 ? `, losing ${attackerUnitsKilled}🧍` : '';

    changeFame(attacker, -1);
    board.gameMessage = `${attacker.name} lost the battle for ${tile.name}${lossStr}`;
    message = `${attacker.name} retreats from ${tile.name}${lossStr}`;
    lostBg = true;
  } else {
    // Tie: no unit loss
    if (tile.level > 1) {
      tile._level = tile.level - 1;
      board.gameMessage = `${attacker.name}'s assault degraded ${tile.name} to level ${tile.level}`;
      message = `No fee paid and ${tile.name} degraded`;
    } else {
      board.gameMessage = `${attacker.name}'s assault on ${tile.name} ends in a stalemate`;
      message = `${attacker.name}'s army retreats`;
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
