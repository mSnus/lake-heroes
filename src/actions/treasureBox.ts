import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';

export function handleTreasureBox(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const goldReward = roll * 100;
  const player = board.activePlayer;
  player.gold += goldReward;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  setMenu({
    type: 'move-result',
    diceRoll: roll,
    passedStart: false,
    specialReward: { type: 'gold', amount: goldReward },
  });
}

