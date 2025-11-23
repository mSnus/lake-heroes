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

export async function rollAndMove(
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

  // Show dice roll as toast and lock the menu while moving
  say(`${player.name} rolled ${roll}!`, 'info');
  setMenu({ type: 'wait' });

  // Step-by-step move with 0.2s delay per tile
  for (let step = 1; step <= roll; step++) {
    const nextPos = (player.position + 1) % BOARD_TILE_COUNT;
    const willWrap = player.position + 1 >= BOARD_TILE_COUNT;

    // Advance the marker by one tile
    player.position = nextPos;
    setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));

    // If we just wrapped around, process passing start
    if (willWrap) {
      passStart(board, setBoard);
    }

    // Delay before the next step to visualize movement
    await new Promise((res) => setTimeout(res, 200));
  }

  // After finishing the movement, determine landing tile and proceed with existing logic
  const tileIdx = player.position;
  const tile = board.tiles[tileIdx];

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

