import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

export function handleTavern(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: tavern');

  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;

  board.gameMessage = `${unitsReward}🧍 joined your mighty forces`;
  updateGameState(board);
  say(`${player.name} recruited units! Rolled ${roll}, received ${unitsReward} U!`, 'success');

  showScreen({
    background: 'assets/screens/tavern.jpg',
    message: board.gameMessage,
    buttons: [{ label: 'Continue', action: 'end-turn', onClick: () => { clearScreen(); setEndTurn(); } }],
  });
}
