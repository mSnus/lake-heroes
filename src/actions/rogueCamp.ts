import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';

export function handleRogueCamp(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  setMenu({
    type: 'move-result',
    diceRoll: roll,
    passedStart: false,
    specialReward: { type: 'units', amount: unitsReward },
  });
}

