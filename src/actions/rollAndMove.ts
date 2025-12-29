import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { MenuState } from '../types/menuState';
import { handleTreasureBox } from './treasureBox';
import { handleTavern } from './tavern';
import { handlePrison } from './prison';
import { handleSphynx } from './sphynx';
import { handleKingCastle } from './king';
import { handleVisitOwnTile } from './visitOwnTile';
import { passStart } from './passStart';
import { afterMoveLogic } from './afterMoveLogic';
import { say } from '../utils/say';
import { TILE_COUNT } from '../components/board/common';
import { gameEvent } from '../utils/events';

export async function rollAndMove(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;

  const roll = rollDice();
  const player = board.activePlayer;

  const nextTileIdx = (player.position + roll) % TILE_COUNT;
  const nextTile = board.tiles[nextTileIdx];

  gameEvent('setPhase', 'rolling');

  board.gameMessage = '';

  let tileMessage = `${player.name} rolled ${roll} and went to ${nextTile.name}`;

  if (!nextTile.isOwned() && !nextTile.isAffordable(player.gold, player.units)) {
    tileMessage += `, but cannot afford to buy it.`;
  }

  say(tileMessage, 'info');

  gameEvent('displayTitle', {});

  // Step-by-step move with 0.2s delay per tile
  for (let step = 1; step <= roll; step++) {
    const nextPos = (player.position + 1) % TILE_COUNT;
    const willWrap = player.position + 1 >= TILE_COUNT;

    gameEvent('setPhase', 'moving');
    player.position = nextPos;
    updateGameState(board);

    if (willWrap) {
      passStart(board, updateGameState);
    }

    gameEvent('displayTitle', board.tiles[nextPos]);
    // Delay before the next step to visualize movement
    await new Promise((res) => setTimeout(res, 300));
  }

  gameEvent('setPhase', 'after-move');
  updateGameState(board);

  // After finishing the movement, determine landing tile and proceed with existing logic
  const tile = board.activeTile;

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

  if (tile.isOwned() && tile.owner === player.name) {
    handleVisitOwnTile(board, updateGameState, setMenu);
    return;
  }

  // Normal move - delegate to afterMoveLogic (buy/fee/fight/auto-end)
  afterMoveLogic(board, updateGameState, setMenu);
}
