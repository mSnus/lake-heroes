import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { TREASURE_BOX_MULTIPLIER } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

type TreasureSize = 'small' | 'medium' | 'large';

const TREASURE_SIZE_MULTIPLIERS: Record<TreasureSize, number> = {
  small: 1,
  medium: 1.5,
  large: 2,
};

// 0-70 small, 70-90 medium, 90-100 large
function rollTreasureSize(): TreasureSize {
  const roll = Math.random() * 100;
  if (roll < 70) return 'small';
  if (roll < 90) return 'medium';
  return 'large';
}

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

  const size = rollTreasureSize();
  const sizeMultiplier = TREASURE_SIZE_MULTIPLIERS[size];
  const goldReward = Math.round(roll * TREASURE_BOX_MULTIPLIER * circleMultiplier * sizeMultiplier);

  player.gold += goldReward;

  updateGameState(board);
  say(
    `${player.name} found a ${size} treasure chest! Rolled ${roll}, received ${goldReward}🟡!`,
    'success'
  );

  showScreen({
    screenType: 'treasure-result',
    background: 'assets/screens/treasure.jpg',
    title: 'Treasure found!',
    htmlMessage: `<span style="color:${player.color}">${player.name}</span> found a ${size} chest with ${goldReward}🟡 inside`,
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
