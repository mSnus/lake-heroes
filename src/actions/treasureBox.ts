import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { MenuState } from '../types/menuState';
import { TREASURE_BOX_MULTIPLIER } from '../game/constants';

export function handleTreasureBox(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: treasure box');

  const goldReward = roll * TREASURE_BOX_MULTIPLIER;
  const player = board.activePlayer;

  player.gold += goldReward;

  updateGameState(board);
  say(`${player.name} found treasure! Rolled ${roll}, received ${goldReward}🟡!`, 'success');

  setMenu({ type: 'treasure-result' });
}
