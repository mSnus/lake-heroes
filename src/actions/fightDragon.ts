import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showDragonChallengeScreen, clearScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { t } from '../i18n';

// Army power (see Player.armyPower) at which a player is even OFFERED the
// challenge -- was a flat 50, disconnected from the Dragon's actual
// strength on the same scale (48 units, see DRAGON_UNITS). Recalibrated to
// the minimal squad that can genuinely contest it: 9 riders ~= 7 dragons,
// so 48 dragons ~= 62 riders, converted to armyPower via the game's own
// RIDER_DUEL_MULTIPLIER (2.2) -- 62 * 2.2 ~= 136. If either constant moves
// again, recheck this against that same 62-rider minimum.
export const DRAGON_UNITS_THRESHOLD = 136;

export function fightDragon(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const player = board.activePlayer;

  showBattleScreen(
    { mode: 'dragon', attacker: player, gameState: board, updateGameState },
    { screenType: 'dragon-battle' }
  );
}

export function offerDragonChallenge(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onDecline: () => void,
  declineLabel?: string
) {
  const p = board.activePlayer;
  showDragonChallengeScreen(
    t('fightDragon.willDareChallenge', {
      playerSpan: `<span style="color:${p.color}">${p.name}</span>`,
    }),
    () => fightDragon(board, updateGameState),
    onDecline,
    declineLabel
  );
}

// Triggered by clicking the dragon icon in the center of the board, once the
// player has already been offered (and possibly declined) the auto-prompt.
export function challengeDragonFromBoard(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  const player = board.activePlayer;
  if (player.armyPower < DRAGON_UNITS_THRESHOLD) {
    say(
      t('fightDragon.needsAtLeast', { playerName: player.name, threshold: DRAGON_UNITS_THRESHOLD }),
      'warning'
    );
    return;
  }
  offerDragonChallenge(board, updateGameState, () => clearScreen(), t('fightDragon.notNow'));
}
