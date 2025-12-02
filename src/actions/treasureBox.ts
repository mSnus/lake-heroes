import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';
import { MenuState } from '../types/menuState';

export function handleTreasureBox(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  console.log('Action: treasure box');

  const dice = new Dice();
  const roll = dice.roll();

  const goldReward = roll * 100;
  const player = board.activePlayer;

  player.gold += goldReward;

  board.gameMessage = `You found a treasure worth ${goldReward}🟡`;
  updateGameState(board);
  say(`${player.name} found treasure! Rolled ${roll}, received ${goldReward}🟡!`, 'success');

  setMenu({ type: 'end-turn' });
}
