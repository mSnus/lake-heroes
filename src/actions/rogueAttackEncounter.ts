import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { showScreenWithFog, clearScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { isHeadlessRun } from '../utils/headlessStore';
import { razeTile } from '../game/raze';
import { changeFame } from '../utils/fame';
import { t } from '../i18n';

const ENCOUNTER_CHANCE = 1 / 14;

/**
 * Rogue Attack: a roaming horde raids one of the player's own tiles.
 * Same trigger odds/preconditions as an ambush, plus needing at least one
 * owned tile to actually target. Goes through the normal BattleScreen duel
 * (brawl or automatic, same rule as any other fight) with a synthetic NPC
 * "horde" Player standing in for the attacker role, so it always auto-rolls
 * regardless of brawl/non-brawl — there's no real entity to click for it.
 * The tile owner's garrison defends as usual (manual click in brawl mode,
 * same as any other tile battle).
 */
export function checkRogueAttackEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  // Cheat: force a rogue attack — skip the odds/eligibility gates. A target
  // tile is still structurally required, so this no-ops (falls through) when
  // the player owns no raidable tile.
  force = false
): boolean {
  const player = board.activePlayer;

  if (!force) {
    // No rogue attacks during the first lap around the board.
    if ((player.circles ?? 0) < 1) return false;

    // Gated on fame alone -- this raids the tile's own garrison, not the
    // player's personal army, so the player's own armyPower/units aren't a
    // relevant precondition.
    if (player.fame < 3) return false;
  }

  // Yielded tiles are under the King's protection -- not a valid target.
  const eligibleTiles = player.ownedTiles.filter((idx) => !board.tiles[idx]?.isYielded);
  if (eligibleTiles.length < 1) return false;
  if (!force && Math.random() >= ENCOUNTER_CHANCE) return false;

  const tileIdx = eligibleTiles[Math.floor(Math.random() * eligibleTiles.length)];
  const tile = board.tiles[tileIdx];
  if (!tile) return false;

  const garrison = tile.garrison;

  // Nothing to defend with — a real BattleScreen duel needs at least one
  // unit on the defending side, so this is an automatic raze, no battle.
  if (garrison <= 0) {
    const tileName = tile.name;
    razeTile(board, tile);
    changeFame(player, -1);
    updateGameState(board);

    // No decision, no battle -- the raze already happened above.
    if (isHeadlessRun()) {
      onContinue();
      return true;
    }

    showScreenWithFog({
      screenType: 'rogue-attack-razed',
      background: 'assets/screens/raid.jpeg',
      title: t('rogueAttack.title'),
      spriteImage: tile.spriteImage,
      fade: true,
      message: t('rogueAttack.razed', { tileName }),
      buttons: [
        {
          label: t('common.continue'),
          onClick: () => {
            clearScreen();
            onContinue();
          },
        },
      ],
    });

    return true;
  }

  const attackFactor = 0.3 + Math.random() * 0.9;
  const hordeUnits = Math.max(1, Math.round(garrison * attackFactor));
  const tileName = tile.name;

  const startBattle = () => {
    const horde = new Player({
      name: t('rogueAttack.horde'),
      color: '#8b5a2b',
      gold: 0,
      units: hordeUnits,
      position: -1,
      image: 'black',
      isComputer: true,
    });

    showBattleScreen(
      { mode: 'rogue', attacker: horde, defender: player, tile, gameState: board, updateGameState, onClose: onContinue },
      { screenType: 'rogue-attack', tileIndex: tileIdx, hordeUnits }
    );
  };

  // No decision here either -- a rogue raid always has to be fought.
  if (isHeadlessRun()) {
    startBattle();
    return true;
  }

  // Announce the raid before it happens -- same background as an ambush
  // (both are "a hostile force appears" beats), with a button to move on to
  // the actual battle.
  showScreenWithFog({
    screenType: 'rogue-attack-incoming',
    background: 'assets/screens/raid.jpeg',
    title: t('rogueAttack.title'),
    fade: true,
    spriteImage: tile.spriteImage,
    htmlMessage: t('rogueAttack.incoming', { tileName, units: hordeUnits }),
    buttons: [{ label: t('rogueAttack.defend'), onClick: startBattle }],
  });

  return true;
}
