import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { DRAGON_UNITS_THRESHOLD, fightDragon } from './fightDragon';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

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
    console.log(`Round ${board.round}`);
  }

  if (board.activePlayer.turnsToSkip > 0) {
    board.activePlayer.turnsToSkip--;
    board.gameMessage = `The prison is wet and cold, ${board.activePlayer.name}`;
    say(`${board.activePlayer.name} dwells in prison and skips the turn`, 'info');
    setEndTurn();
  } else if (board.activePlayer.units >= DRAGON_UNITS_THRESHOLD) {
    say(`${board.activePlayer.name} has ${board.activePlayer.units}🧍 — enough to challenge the Dragon!`, 'info');
    board.gameMessage = `Challenge the Dragon or roll dice?`;
    showScreen({
      background: 'assets/screens/dragon.jpg',
      message: board.gameMessage,
      buttons: [
        {
          label: 'Challenge the Dragon 🐉',
          action: 'fight',
          onClick: () => { clearScreen(); fightDragon(board, updateGameState); },
        },
        {
          label: 'Roll Dice Instead 🎲',
          action: 'roll-dice',
          onClick: () => { clearScreen(); gameEvent('showDice', null); },
        },
      ],
    });
  } else {
    gameEvent('showDice', null);
  }

  updateGameState(board);
}
