import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { DRAGON_UNITS_THRESHOLD, fightDragon } from './fightDragon';
import { showDragonChallengeScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { checkDragonEncounter } from './dragonEncounter';
import { checkCaravanEncounter } from './caravanEncounter';

export function endTurn(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  console.log('Action: end turn for', board.activePlayer.name);

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  board.gameMessage = '';

  if (board.activePlayerIndex === 0) {
    board.round++;
    console.debug(`Round ${board.round}`, board.players);
  }

  if (board.activePlayer.turnsToSkip > 0) {
    board.activePlayer.turnsToSkip--;
    board.gameMessage = `The prison is wet and cold, ${board.activePlayer.name}`;
    say(`${board.activePlayer.name} dwells in prison and skips the turn`, 'info');
    updateGameState(board);
    setEndTurn();
    return;
  }

  if (board.activePlayer.units >= DRAGON_UNITS_THRESHOLD) {
    say(`${board.activePlayer.name} has ${board.activePlayer.units}🧍 — enough to challenge the Dragon!`, 'info');
    board.gameMessage = `Challenge the Dragon or roll dice?`;
    updateGameState(board);
    showDragonChallengeScreen(
      board.gameMessage,
      () => fightDragon(board, updateGameState),
      () => gameEvent('showDice', null)
    );
    return;
  }

  // Check random encounters before the player rolls
  updateGameState(board);
  const showDice = () => gameEvent('showDice', null);
  if (checkDragonEncounter(board, updateGameState, showDice)) return;
  if (checkCaravanEncounter(board, updateGameState, showDice)) return;
  gameEvent('showDice', null);
}
