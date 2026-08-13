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
 *   from the fight, then grows 25% on top of what survived, capped by
 *   capacity.
 * - Tie (mutual wipe): garrison takes real losses equal to the attack, but
 *   the tile itself isn't lost.
 *
 * `defenderUnitsKilled` is already a real militia/riders headcount by the
 * time it reaches here — see the equivalent note in resolveTileBattle.ts.
 */
export function resolveRogueAttack(
  board: GameState,
  player: Player,
  tile: Tile,
  defenderUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const tileName = tile.name;

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
    tile.isYielded = false;
    tile.garrison = tile.baseGarrison;
    tile.unclaimedSinceTurn = board.turns;
    tile.razedInRound = board.round;
    changeFame(player, -1);

    message = t('rogueAttack.razed', { tileName });
    lostBg = true;
  } else if (outcome === 'defender') {
    tile.garrison = Math.max(0, tile.garrison - defenderUnitsKilled);
    const before = tile.garrison;
    tile.garrison = before + Math.round(before * 0.25);
    const gained = tile.garrison - before;

    // The attack is repelled: report the garrison's own losses, then the
    // routed attackers who were impressed into joining the defender's garrison.
    const lossMsg = defenderUnitsKilled > 0 ? t('rogueAttack.garrisonLost', { tileName, units: defenderUnitsKilled }) : '';
    const joinMsg =
      gained > 0
        ? t('rogueAttack.attackersJoin', { units: gained, playerName: player.name })
        : t('rogueAttack.wonFull', { tileName });
    message = [lossMsg, joinMsg].filter(Boolean).join('\n');
    victoryBg = true;
  } else {
    const loss = defenderUnitsKilled;
    tile.garrison = Math.max(0, tile.garrison - loss);
    message = t('rogueAttack.tie', { tileName, units: loss });
  }

  return { outcome, message, victoryBg, lostBg };
}
