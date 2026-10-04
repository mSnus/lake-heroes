import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { razeTile } from '../../game/tileOwnership';
import { changeFame } from '../../utils/fame';
import { say } from '../../utils/say';
import { setGameMessage } from '../../utils/gameMessage';
import { BattleResolution, BattleOutcome, garrisonLostStr } from './common';
import { t } from '../../i18n';

/**
 * Resolve a Rogue Attack: a roaming horde raids one of the player's tiles.
 * The "attacker" role in BattleScreen is a synthetic NPC horde (no real
 * consequences land on it) — only the tile owner's garrison, fame, and
 * ownership are ever affected here.
 * - Win (outcome 'attacker', horde wins): tile is razed, same as losing a
 *   real tile battle.
 * - Loss (outcome 'defender', garrison wins): garrison takes real losses
 *   from the fight, nothing more -- repelling the horde no longer grows
 *   the garrison with impressed attackers.
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
    razeTile(board, tile);
    changeFame(player, -1);

    message = t('rogueAttack.razed', { tileName });
    lostBg = true;
    setGameMessage(board, t('rogueAttack.razedToast', { playerName: player.name, tileName }));
    say(t('rogueAttack.razedToast', { playerName: player.name, tileName }), 'error');
  } else if (outcome === 'defender') {
    // Measured across the write: a garrison loses militia before riders
    // (see Tile's `garrison` setter), so a headcount would misreport which
    // tier actually fell.
    const garrisonBefore = { militia: tile.garrisonMilitia, riders: tile.garrisonRiders };
    tile.garrison = Math.max(0, tile.garrison - defenderUnitsKilled);
    const killed = garrisonLostStr(garrisonBefore, tile);

    // The attack is repelled: report the garrison's own losses, if any.
    const lossMsg = killed ? t('rogueAttack.garrisonLost', { tileName, army: killed }) : '';
    message = [lossMsg, t('rogueAttack.wonFull', { tileName })].filter(Boolean).join('\n');
    victoryBg = true;

    const toast = t('rogueAttack.wonToast', { playerName: player.name, tileName });
    setGameMessage(board, toast);
    say(toast, 'success');
  } else {
    const garrisonBefore = { militia: tile.garrisonMilitia, riders: tile.garrisonRiders };
    tile.garrison = Math.max(0, tile.garrison - defenderUnitsKilled);
    const killed = garrisonLostStr(garrisonBefore, tile);
    message = t('rogueAttack.tie', { tileName, army: killed });

    const toast = t('rogueAttack.tieToast', { playerName: player.name, tileName, army: killed });
    setGameMessage(board, toast);
    say(toast, 'info');
  }

  return { outcome, message, victoryBg, lostBg };
}
