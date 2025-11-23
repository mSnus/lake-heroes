import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';
import { handleTreasureBox } from './treasureBox';
import { handleRogueCamp } from './rogueCamp';
import { handlePrison } from './prison';
import { handleSphynx } from './sphynx';
import { passStart } from './passStart';
import { afterMoveLogic } from './afterMoveLogic';
import { say } from '../utils/say';

const BOARD_TILE_COUNT = 20;

export function rollAndMove(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void,
  endTurn: () => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const player = board.activePlayer;
  const oldPos = player.position;
  const newPos = (oldPos + roll) % BOARD_TILE_COUNT;
  const passedStart = oldPos + roll >= BOARD_TILE_COUNT;
  player.position = newPos;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));

  // Show dice roll as toast
  say(`${player.name} rolled ${roll}!`, 'info');

  // Check for passing start
  if (passedStart) {
    passStart(board, setBoard);
  }

  // Check for special tiles immediately after moving
  const tile = board.tiles[newPos];
  if (tile.name.includes('Treasure box')) {
    handleTreasureBox(board, setBoard, endTurn);
    return;
  }
  if (tile.name.includes('Rogue camp')) {
    handleRogueCamp(board, setBoard, endTurn);
    return;
  }
  if (tile.name.includes('Prison')) {
    handlePrison(board, setBoard, setMenu);
    return;
  }
  if (tile.name.includes('Sphynx')) {
    handleSphynx(board, setBoard, endTurn);
    return;
  }

  // Normal move - delegate to afterMoveLogic (buy/fee/fight/auto-end)
  afterMoveLogic(board, setBoard, setMenu, endTurn);
}

