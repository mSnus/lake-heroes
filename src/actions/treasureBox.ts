import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { TREASURE_BOX_MULTIPLIER } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

export function handleTreasureBox(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: treasure box');

  const MULTIPLIER_CIRCLES_START = 1;
  const MULTIPLIER_CIRCLES_6 = 2;
  const MULTIPLIER_CIRCLES_12 = 2.5;

  const player = board.activePlayer;
  const circles = player.circles ?? 0;
  const circleMultiplier =
    circles >= 12
      ? MULTIPLIER_CIRCLES_12
      : circles >= 6
        ? MULTIPLIER_CIRCLES_6
        : MULTIPLIER_CIRCLES_START;
  const goldReward = Math.round(roll * TREASURE_BOX_MULTIPLIER * circleMultiplier);

  player.gold += goldReward;
  board.gameMessage = `${player.name} found ${goldReward}🟡 in the treasure!`;

  updateGameState(board);
  say(`${player.name} found treasure! Rolled ${roll}, received ${goldReward}🟡!`, 'success');

  showScreen({
    screenType: 'treasure-result',
    background: 'assets/screens/treasure.jpg',
    message: board.gameMessage,
    fade: true,
    buttons: [
      {
        label: 'Let the treasures grow!',
        action: 'end-turn',
        onClick: () => {
          clearScreen();
          setEndTurn();
        },
      },
    ],
  });
}
