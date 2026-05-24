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

  const player = board.activePlayer;
  const circles = player.circles ?? 0;
  const circleMultiplier = circles >= 12 ? 2 : circles >= 6 ? 1.5 : 1;
  const goldReward = Math.round(roll * TREASURE_BOX_MULTIPLIER * circleMultiplier);

  player.gold += goldReward;
  board.gameMessage = `${player.name} found ${goldReward}🟡 in the treasure!`;

  updateGameState(board);
  say(`${player.name} found treasure! Rolled ${roll}, received ${goldReward}🟡!`, 'success');

  showScreen({
    background: 'assets/screens/treasure.jpg',
    message: board.gameMessage,
    fade: true,
    buttons: [{ label: 'Let the treasures grow!', action: 'end-turn', onClick: () => { clearScreen(); setEndTurn(); } }],
  });
}
