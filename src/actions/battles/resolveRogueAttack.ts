import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { razeTile } from '../../game/tileOwnership';
import { changeFame } from '../../utils/fame';
import { say } from '../../utils/say';
import { setGameMessage } from '../../utils/gameMessage';
import { getOverrides } from '../../utils/overridesStore';
import { BattleResolution, BattleOutcome, garrisonLostStr } from './common';
import { t } from '../../i18n';

/** Share of the routed horde that is impressed into the winning garrison. */
const ROGUE_JOIN_RATIO = 0.25;

/**
 * Resolve a Rogue Attack: a roaming horde raids one of the player's tiles.
 * The "attacker" role in BattleScreen is a synthetic NPC horde (no real
 * consequences land on it) — only the tile owner's garrison, fame, and
 * ownership are ever affected here.
 * - Win (outcome 'attacker', horde wins): tile is razed, same as losing a
 *   real tile battle.
 * - Loss (outcome 'defender', garrison wins): garrison takes real losses
 *   from the fight, then ROGUE_JOIN_RATIO of the routed horde joins it,
 *   capped by the tile's remaining capacity.
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
  hordeUnits: number,
  defenderUnitsKilled: number,
  hordeUnitsKilled: number,
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

    // Sized by the horde that was routed, not by the garrison that survived.
    // Off the survivors it paid least exactly when the win was cleanest -- a
    // flawless defence left the garrison full, so the growth was entirely
    // clamped away and the victor got nothing. In a brawl the individual
    // kills are visual-only, so fall back to the whole horde (same reasoning
    // as resolveAmbush's own reward).
    const routed = hordeUnitsKilled > 0 ? hordeUnitsKilled : hordeUnits;
    const impressed = Math.round(routed * ROGUE_JOIN_RATIO);
    const before = tile.garrison;
    tile.garrison = before + impressed;
    const gained = tile.garrison - before;

    // Whoever the garrison had no room for is stripped for kit instead, so a
    // full tile still profits from the win rather than silently getting
    // nothing (the setter clamps the write above, hence the difference).
    const pillaged = impressed - gained;
    const loot = pillaged * getOverrides().militiaPrice;
    if (loot > 0) player.gold += loot;

    // The attack is repelled: report the garrison's own losses, then the
    // routed attackers who were impressed into joining the defender's garrison.
    const lossMsg = killed ? t('rogueAttack.garrisonLost', { tileName, army: killed }) : '';
    const joinMsg = gained > 0 ? t('rogueAttack.attackersJoin', { units: gained, playerName: player.name }) : '';
    const lootMsg = loot > 0 ? t('rogueAttack.pillaged', { units: pillaged, gold: loot }) : '';
    const spoils = [joinMsg, lootMsg].filter(Boolean).join('\n');
    message = [lossMsg, spoils || t('rogueAttack.wonFull', { tileName })].filter(Boolean).join('\n');
    victoryBg = true;

    const toast = loot > 0
      ? t('rogueAttack.wonLootToast', { playerName: player.name, tileName, gold: loot })
      : t('rogueAttack.wonToast', { playerName: player.name, tileName });
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
