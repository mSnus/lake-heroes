import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

export function handleTavern(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: tavern');

  const player = board.activePlayer;
  const circles = player.circles ?? 0;
  const circleMultiplier = circles >= 12 ? 2 : circles >= 6 ? 1.5 : 1;
  const unitsReward = Math.round(roll * circleMultiplier);
  player.units += unitsReward;

  updateGameState(board);

  showScreen({
    screenType: 'tavern-result',
    background: 'assets/screens/tavern.jpg',
    htmlMessage: `${unitsReward}🧍 joined <span style="color:${player.color}">${player.name}</span>'s mighty forces`,
    buttons: [
      {
        label: 'New folks are always welcome!',
        action: 'end-turn',
        onClick: () => {
          clearScreen();
          setEndTurn();
        },
      },
    ],
  });
}
