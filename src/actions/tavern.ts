import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';
import { MenuState } from '../types/menuState';

export function handleTavern(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  console.log('Action: tavern');

  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;

  board.gameMessage = ` ${unitsReward}🧍 joined your mighty forces`;
  updateGameState(board);
  say(`${player.name} recruited units! Rolled ${roll}, received ${unitsReward} U!`, 'success');

  setMenu({ type: 'end-turn' });
}
