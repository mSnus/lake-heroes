import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showDragonChallengeScreen, clearScreen } from '../utils/screenStore';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { t } from '../i18n';

// Army power (see Player.armyPower) at which a player is even OFFERED the
// challenge. The Dragon's true strength on the same scale is far higher
// than any army can reach -- the hard slot cap (5 slots x 12 units, see
// ARMY_SLOT_CAPACITY/MAX_ARMY_SLOTS) limits armyPower to at most 60 riders
// x RIDER_DUEL_MULTIPLIER (2.2) = 132. Set just under that ceiling so a
// near-maxed army can still get the offer.
export const DRAGON_UNITS_THRESHOLD = 120;

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
