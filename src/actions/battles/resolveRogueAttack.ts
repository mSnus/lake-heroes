import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { changeFame } from '../../utils/fame';
import { BattleResolution, BattleOutcome } from './common';
import { t } from '../../i18n';

/**
 * Resolve a Rogue Attack: a roaming horde raids one of the player's tiles.
 * The "attacker" role in BattleScreen is a synthetic NPC horde (no real
 * consequences land on it) — only the tile owner's garrison, fame, and
 * ownership are ever affected here.
 * - Win (outcome 'attacker', horde wins): tile is razed, same as losing a
 *   real tile battle.
 * - Loss (outcome 'defender', garrison wins): garrison takes real losses
 *   from the fight (rescaled from grid kills, same as a normal tile
 *   battle), then grows 25% on top of what survived, capped by capacity.
 * - Tie (mutual wipe): garrison takes real losses equal to the (rescaled)
 *   attack, but the tile itself isn't lost.
 */
export function resolveRogueAttack(
  board: GameState,
  player: Player,
  tile: Tile,
  defenderUnitsKilled: number,
  outcome: BattleOutcome,
  defenceGridSize: number
): BattleResolution {
  const tileName = tile.name;

  const realGarrisonLoss = (gridKills: number): number => {
    if (gridKills <= 0 || defenceGridSize <= 0) return 0;
    const realGarrison = tile.garrisonMilitia + tile.garrisonRiders;
    return Math.min(realGarrison, Math.round((gridKills / defenceGridSize) * realGarrison));
  };

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    const tileIdx = board.tiles.indexOf(tile);
    board.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((i) => i !== tileIdx);
    });
    tile.owner = null;
    tile._level = 1;
    tile.garrison = tile.baseGarrison;
    tile.unclaimedSinceTurn = board.turns;
    tile.razedInRound = board.round;
    changeFame(player, -1);

    message = t('rogueAttack.razed', { tileName });
    lostBg = true;
  } else if (outcome === 'defender') {
    tile.garrison = Math.max(0, tile.garrison - realGarrisonLoss(defenderUnitsKilled));
    const before = tile.garrison;
    tile.garrison = before + Math.round(before * 0.25);
    const gained = tile.garrison - before;

    message = gained > 0 ? t('rogueAttack.wonGrows', { tileName, units: gained }) : t('rogueAttack.wonFull', { tileName });
    victoryBg = true;
  } else {
    const loss = realGarrisonLoss(defenderUnitsKilled);
    tile.garrison = Math.max(0, tile.garrison - loss);
    message = t('rogueAttack.tie', { tileName, units: loss });
  }

  return { outcome, message, victoryBg, lostBg };
}
