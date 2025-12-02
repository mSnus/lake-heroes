import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';
import { MenuState } from '../types/menuState';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void,
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle');

  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;
  updateGameState(board);
  say(`King provides ${player.name} with ${unitsReward}🧍!`, 'success');
  setMenu({ type: 'end-turn' });
}
