import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { hasArtifact } from '../game/artifacts';
import { recordStatEvent } from '../game/statistics';
import { t } from '../i18n';

/**
 * Handle landing on Sphynx tile.
 * Rules per spec:
 * - Roll 1–2: lose half of current gold, rounded UP to the nearest 50 (cap at current gold).
 * - Roll 3–4: lose 20% of current units, rounded UP to 1 (cap at current units).
 * - Roll 5: nothing happens.
 * - Roll 6: gain 20% of current gold, rounded UP to the nearest 100.
 * After applying effect, end the turn.
 */
export function handleSphynx(
  gameState: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!gameState) return;

  const player = gameState.activePlayer;
  let message = '';
  let screenMessage = '';
  const pipeSaved = roll <= 4 && hasArtifact(player, 'pipe-of-hamelin');

  // Pipe of Hamelin charms the Sphynx, negating any negative outcome (rolls 1–4).
  if (pipeSaved) {
    message = t('sphynx.pipeSavedMessage');
    screenMessage = message;
  } else if (roll === 1 || roll === 2) {
    // Lose half gold, rounded up to nearest 50, capped by available gold
    if (player.gold > 0) {
      const half = player.gold / 2;
      const roundedUp50 = Math.ceil(half / 50) * 50;
      const loss = Math.min(player.gold, roundedUp50);

      player.gold -= loss;
      message = t('sphynx.lostGoldMessage', { gold: loss });
      screenMessage = t('sphynx.lostGoldScreen', { gold: loss });
    } else {
      message = t('sphynx.povertyMessage');
      screenMessage = t('sphynx.povertyScreen');
    }
  } else if (roll === 3 || roll === 4) {
    // Lose 33% units, minimum 1, floor at 0
    const raw = Math.ceil(player.units * 0.33);
    const loss = Math.max(1, raw);

    player.units = Math.max(0, player.units - loss);
    message = t('sphynx.ateUnitsMessage', { units: loss });
    screenMessage = t('sphynx.ateUnitsScreen', { units: loss });
  } else if (roll === 5) {
    message = t('sphynx.nothingMessage');
    screenMessage = t('sphynx.nothingScreen');
  } else if (roll === 6) {
    // Gain 20% gold, rounded up to nearest 100, with a floor of 800
    const bonusBase = player.gold * 0.2;
    const gain = Math.max(800, Math.ceil(bonusBase / 100) * 100);
    player.gold += gain;
    message = t('sphynx.gainGoldMessage', { gold: gain });
    screenMessage = t('sphynx.gainGoldScreen', { gold: gain });
  }

  // Visiting the Sphynx always grants fame, win or lose.
  player.fame += 1;
  message += ' ' + t('sphynx.fameSuffix');

  recordStatEvent(gameState, player, 'sphynx');
  updateGameState(gameState);

  say(message, roll === 6 ? 'success' : roll === 5 || pipeSaved ? 'info' : 'warning');

  showScreen({
    screenType: 'sphynx-result',
    background: 'assets/screens/sphynx.jpg',
    fade: true,
    message: screenMessage,
    buttons: [
      {
        label: t('common.continue'),
        action: 'end-turn',
        onClick: () => {
          clearScreen();
          setEndTurn();
        },
      },
    ],
  });
}
