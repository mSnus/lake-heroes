import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { DRAGON_UNITS_THRESHOLD, offerDragonChallenge } from './fightDragon';
import { setEndTurn } from '../utils/endTurnStore';
import { releasePrisonerOfWar } from './releasePrisonerOfWar';
import { t } from '../i18n';

export function endTurn(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  console.log('Action: end turn for', board.activePlayer.name);

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  board.gameMessage = '';
  board.activePlayer.hasClaimedThisTurn = false;
  board.activePlayer.hasConsideredClaimThisTurn = false;
  board.activePlayer.upgradesThisTurn = 0;

  if (board.activePlayerIndex === 0) {
    board.round++;
    console.debug(`Round ${board.round}`, board.players);
  }

  if (board.activePlayer.turnsToSkip > 0) {
    board.activePlayer.turnsToSkip--;
    board.skippingTurn = true;
    board.gameMessage = t('endTurn.prisonIsWetAndCold', { playerName: board.activePlayer.name });
    say(t('endTurn.dwellsInPrison', { playerName: board.activePlayer.name }), 'info');
    updateGameState(board);
    setEndTurn();
    return;
  }

  board.skippingTurn = false;

  // A prisoner of war who has served their skipped turn is ransomed by the King
  // before they roll to leave prison.
  if (board.activePlayer.isPrisonerOfWar) {
    releasePrisonerOfWar(board);
    updateGameState(board);
  }

  if (
    board.activePlayer.armyPower >= DRAGON_UNITS_THRESHOLD &&
    !board.activePlayer.hasBeenOfferedDragonChallenge
  ) {
    board.activePlayer.hasBeenOfferedDragonChallenge = true;
    say(
      t('endTurn.enoughToChallengeDragon', {
        playerName: board.activePlayer.name,
        units: board.activePlayer.units,
      }),
      'info'
    );
    board.gameMessage = t('endTurn.dragonGuardsGold');
    updateGameState(board);
    offerDragonChallenge(board, updateGameState, () => gameEvent('showDice', null));
    return;
  }

  updateGameState(board);
  gameEvent('showDice', null);
}
