import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { DRAGON_UNITS_THRESHOLD, offerDragonChallenge } from './fightDragon';
import { setEndTurn } from '../utils/endTurnStore';
import { releasePrisonerOfWar } from './releasePrisonerOfWar';

export function endTurn(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  console.log('Action: end turn for', board.activePlayer.name);

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  board.gameMessage = '';
  board.activePlayer.hasClaimedThisTurn = false;
  board.activePlayer.upgradesThisTurn = 0;

  if (board.activePlayerIndex === 0) {
    board.round++;
    console.debug(`Round ${board.round}`, board.players);
  }

  if (board.activePlayer.turnsToSkip > 0) {
    board.activePlayer.turnsToSkip--;
    board.skippingTurn = true;
    board.gameMessage = `The prison is wet and cold, ${board.activePlayer.name}`;
    say(`${board.activePlayer.name} dwells in prison and skips the turn`, 'info');
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
    board.activePlayer.units >= DRAGON_UNITS_THRESHOLD &&
    !board.activePlayer.hasBeenOfferedDragonChallenge
  ) {
    board.activePlayer.hasBeenOfferedDragonChallenge = true;
    say(
      `${board.activePlayer.name} has ${board.activePlayer.units}🧍 — enough to challenge the Dragon!`,
      'info'
    );
    board.gameMessage = `Terrifying dragon guards a pile of gold and jewels`;
    updateGameState(board);
    offerDragonChallenge(board, updateGameState, () => gameEvent('showDice', null));
    return;
  }

  updateGameState(board);
  gameEvent('showDice', null);
}
