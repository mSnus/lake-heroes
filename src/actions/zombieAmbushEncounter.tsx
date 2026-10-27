import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { isHeadlessRun } from '../utils/headlessStore';
import { ZOMBIE_AMBUSH_CHANCE, ZOMBIE_AMBUSH_FORCE_RATIO } from '../game/constants';
import { t } from '../i18n';

/**
 * An abandoned (zombie-guarded) tile has a chance to ambush the player the
 * moment they land on it — same mechanics as a regular Ambush
 * (ambushEncounter.tsx), but the attackers are zombies drawn from the
 * tile's own garrison rather than a % of the player's own army. Either way
 * the tile itself is untouched: this never claims or re-arms it, so the
 * player can still separately choose to pay/fight/claim it afterward.
 */
export function checkZombieAmbushEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;
  const tile = board.activeTile;

  if (tile.isOwned() || !tile.abandoned || tile.garrison <= 0) return false;

  const attackerUnits = Math.max(1, Math.round(tile.garrison * ZOMBIE_AMBUSH_FORCE_RATIO));

  // Only ambush a player whose army can actually field a real fight against
  // the zombie force -- skips a near-defenseless player getting wiped out by
  // a garrison much bigger than their whole army.
  if (player.units < attackerUnits) return false;

  if (Math.random() >= ZOMBIE_AMBUSH_CHANCE) return false;

  const startBattle = () => {
    showBattleScreen(
      { mode: 'ambush', attacker: player, ambushAttackerUnits: attackerUnits, isZombieAmbush: true, gameState: board, updateGameState, onClose: onContinue },
      { screenType: 'zombie-ambush-battle', ambushAttackerUnits: attackerUnits }
    );
  };

  // No decision -- a zombie ambush always has to be fought.
  if (isHeadlessRun()) {
    startBattle();
    return true;
  }

  showScreen({
    screenType: 'zombie-ambush',
    background: 'assets/screens/zombies.jpeg',
    title: t('zombieAmbush.title'),
    fade: true,
    spriteImage: 'assets/figures/npc-skeleton.png',
    spriteNoRing: true,
    htmlMessage: t('zombieAmbush.message', {
      playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
      units: attackerUnits,
      tileName: tile.name,
    }),
    buttons: [{ label: '🧟‍♀️' + t('ambushEncounter.defend'), onClick: startBattle }],
  });

  return true;
}
