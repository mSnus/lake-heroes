import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';

const BOARD_TILE_COUNT = 40;

export function rollAndMove(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const player = board.activePlayer;
  const oldPos = player.position;
  const newPos = (oldPos + roll) % BOARD_TILE_COUNT;
  const passedStart = oldPos + roll >= BOARD_TILE_COUNT;
  player.position = newPos;
  if (passedStart) {
    player.gold += 500;
    player.units += 5;
  }
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  setMenu({ type: 'move-result', diceRoll: roll, passedStart });
}

