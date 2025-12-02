import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { MenuState } from '../types/menuState';
import { handleTreasureBox } from './treasureBox';
import { handleTavern } from './tavern';
import { handlePrison } from './prison';
import { handleSphynx } from './sphynx';
import { handleKingCastle } from './king';
import { passStart } from './passStart';
import { afterMoveLogic } from './afterMoveLogic';
import { say } from '../utils/say';

const BOARD_TILE_COUNT = 20;

export async function rollAndMove(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();
  const player = board.activePlayer;

  const nextTileIdx = (player.position + roll) % BOARD_TILE_COUNT;
  const nextTile = board.tiles[nextTileIdx];

  board.gameMessage = '';
  say(`${player.name} rolled ${roll} and went to ${nextTile.name}!`, 'info');

  window.dispatchEvent(new CustomEvent('setViewedTitle', {}));

  // Step-by-step move with 0.2s delay per tile
  for (let step = 1; step <= roll; step++) {
    const nextPos = (player.position + 1) % BOARD_TILE_COUNT;
    const willWrap = player.position + 1 >= BOARD_TILE_COUNT;

    board.turnPhase = 'moving';
    player.position = nextPos;
    updateGameState(board);

    if (willWrap) {
      passStart(board, updateGameState);
    }

    // Delay before the next step to visualize movement
    await new Promise((res) => setTimeout(res, 200));
  }

  board.turnPhase = 'after-move';

  // After finishing the movement, determine landing tile and proceed with existing logic
  const tileIdx = player.position;
  const tile = board.tiles[tileIdx];

  if (tile.name.includes('Treasure')) {
    handleTreasureBox(board, updateGameState, setMenu);
    return;
  }
  if (tile.name.includes('Tavern')) {
    handleTavern(board, updateGameState, setMenu);
    return;
  }
  if (tile.name.includes('Prison')) {
    handlePrison(board, updateGameState, setMenu);
    return;
  }
  if (tile.name.includes('Sphynx')) {
    handleSphynx(board, updateGameState, setMenu);
    return;
  }
  if (tile.name.includes('King')) {
    handleKingCastle(board, updateGameState, setMenu);
    return;
  }

  // Normal move - delegate to afterMoveLogic (buy/fee/fight/auto-end)
  afterMoveLogic(board, updateGameState, setMenu);
}
