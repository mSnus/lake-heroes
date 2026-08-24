import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { isHeadlessRun } from '../utils/headlessStore';
import { t } from '../i18n';

const RUINS_FORCE_RATIO_MIN = 0.6;
const RUINS_FORCE_RATIO_MAX = 0.8;

/**
 * The Ruins tile's fixed encounter: landing there always triggers a fight
 * against its monster occupants, sized off the player's own squad (90-105%
 * of their headcount) -- no odds/eligibility gate, no way to decline. See
 * actions/battles/resolveRuinsBattle.ts for the outcome (units lost either
 * way, an artifact chance on a win or tie).
 */
export function showRuinsEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): void {
  const player = board.activePlayer;
  const ratio = RUINS_FORCE_RATIO_MIN + Math.random() * (RUINS_FORCE_RATIO_MAX - RUINS_FORCE_RATIO_MIN);
  const attackerUnits = Math.max(1, Math.round(player.units * ratio));

  const startBattle = () => {
    showBattleScreen(
      {
        mode: 'ambush',
        attacker: player,
        ambushAttackerUnits: attackerUnits,
        isZombieAmbush: true,
        isRuins: true,
        gameState: board,
        updateGameState,
        onClose: onContinue,
      },
      { screenType: 'ruins-battle', ambushAttackerUnits: attackerUnits }
    );
  };

  // No decision -- the Ruins always have to be fought.
  if (isHeadlessRun()) {
    startBattle();
    return;
  }

  showScreen({
    screenType: 'ruins',
    background: 'assets/screens/ruins.jpg',
    title: t('ruinsEncounter.title'),
    fade: true,
    spriteImage: 'assets/sprites/ruins.png',
    htmlMessage: t('ruinsEncounter.message', {
      playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
    }),
    buttons: [{ label: t('ruinsEncounter.fight'), onClick: startBattle }],
  });
}
