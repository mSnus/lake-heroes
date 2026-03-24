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
import { showModal } from '../utils/modalStore';

export async function rollAndMove(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void,
  preRolledValue?: number
) {
  console.log('Roll and move');

  if (!board) return;

  // Use the value already rolled by the dice widget (avoids re-triggering the animation)
  const roll = preRolledValue !== undefined ? preRolledValue : rollDice();
  console.log('Rolled ', roll);
  const player = board.activePlayer;

  const nextTileIdx = (player.position + roll) % TILE_COUNT;
  const nextTile = board.tiles[nextTileIdx];

  gameEvent('setPhase', 'rolling');

  board.gameMessage = '';

  let tileMessage = `${player.name} rolled ${roll} and went to ${nextTile.name}`;

  if (!nextTile.isOwned() && !nextTile.isAffordable(player.gold, player.units)) {
    tileMessage += `, but cannot afford to buy it.`;
  }

  say(tileMessage, 'debug');

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

  board.setPhase('after-move');
  board.incTurns();
  updateGameState(board);

  // After finishing the movement, determine landing tile and proceed with existing logic
  const tile = board.activeTile;

  if (tile.name.includes('Treasure')) {
    board.gameMessage = `Roll dice! Discover the treasure inside...`;
    updateGameState(board);
    setMenu({ type: 'treasure-waiting' });
    showModal('dice', (roll: number) => handleTreasureBox(board, updateGameState, setMenu, roll));
    return;
  }
  if (tile.name.includes('Tavern')) {
    board.gameMessage = `Roll dice! The tavern keeper awaits your roll...`;
    updateGameState(board);
    setMenu({ type: 'tavern-waiting' });
    showModal('dice', (roll: number) => handleTavern(board, updateGameState, setMenu, roll));
    return;
  }
  if (tile.name.includes('Prison')) {
    handlePrison(board, updateGameState, setMenu);
    return;
  }
  if (tile.name.includes('Sphynx')) {
    board.gameMessage = `Roll dice! The Sphynx awaits your fate...`;
    updateGameState(board);
    setMenu({ type: 'sphynx-waiting' });
    showModal('dice', (roll: number) => handleSphynx(board, updateGameState, setMenu, roll));
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
