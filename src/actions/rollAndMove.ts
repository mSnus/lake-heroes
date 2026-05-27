import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { handleTreasureBox } from './treasureBox';
import { handleTavern } from './tavern';
import { handlePrison } from './prison';
import { handleSphynx } from './sphynx';
import { handleKingCastle } from './king';
import { handleJoker } from './joker';
import { handlePortal } from './portal';
import { handleVisitOwnTile } from './visitOwnTile';
import { passStart } from './passStart';
import { afterMoveLogic } from './afterMoveLogic';
import { revealTile } from './revealTile';
import { say } from '../utils/say';
import { TILE_COUNT } from '../game/constants';
import { gameEvent } from '../utils/events';
import { showDice, startDiceRoll } from '../utils/diceStore';
import { showScreen } from '../utils/screenStore';

export async function rollAndMove(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
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

  if (!nextTile.isOwned() && !nextTile.isAffordable(player.gold, player.units, player.fame)) {
    tileMessage += `, but cannot afford to buy it.`;
  }

  say(tileMessage, 'debug');

  gameEvent('displayTile', {});

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

    gameEvent('displayTile', board.tiles[nextPos].fogged() ? {} : board.tiles[nextPos]);
    // Delay before the next step to visualize movement
    await new Promise((res) => setTimeout(res, 300));
  }

  board.setPhase('after-move');
  board.incTurns();
  const wasFogged = board.activeTile.fog;
  board.activeTile.fog = false;
  if (wasFogged) {
    revealTile(board);
    gameEvent('displayTile', board.activeTile);
  }
  updateGameState(board);

  // After finishing the movement, determine landing tile and proceed with existing logic
  const continueTileLogic = () => {
    const tile = board.activeTile;
    if (tile.name.includes('Treasure')) {
      board.gameMessage = `Roll dice! Discover the treasure inside...`;
      updateGameState(board);
      showDice((roll: number) => handleTreasureBox(board, updateGameState, roll));
      showScreen({
        screenType: 'treasure',
        background: 'assets/screens/treasure.jpg',
        title: tile.name,
        buttons: [{ label: 'Roll Dice 🎲', action: 'roll-dice', onClick: startDiceRoll }],
      });
      return;
    }
    if (tile.name.includes('Tavern')) {
      board.gameMessage = `Roll dice! The tavern keeper awaits your roll...`;
      updateGameState(board);
      showDice((roll: number) => handleTavern(board, updateGameState, roll));
      showScreen({
        screenType: 'tavern',
        background: 'assets/screens/tavern.jpg',
        title: tile.name,
        fade: true,
        buttons: [{ label: 'Roll Dice 🎲', action: 'roll-dice', onClick: startDiceRoll }],
      });
      return;
    }
    if (tile.name.includes('Prison')) {
      handlePrison(board, updateGameState);
      return;
    }
    if (tile.name.includes('Sphynx')) {
      board.gameMessage = `Roll dice! The Sphynx awaits your fate...`;
      updateGameState(board);
      showDice((roll: number) => handleSphynx(board, updateGameState, roll));
      showScreen({
        screenType: 'sphynx',
        background: 'assets/screens/sphynx.jpg',
        title: '',
        fade: true,
        buttons: [{ label: 'Roll Dice 🎲', action: 'roll-dice', onClick: startDiceRoll }],
      });
      return;
    }
    if (tile.name.includes('Portal')) {
      handlePortal(board, updateGameState, continueTileLogic);
      return;
    }
    if (tile.name.includes('King')) {
      handleKingCastle(board, updateGameState);
      return;
    }
    if (tile.name.includes('Joker')) {
      handleJoker(board, updateGameState);
      return;
    }

    if (tile.isOwned() && tile.owner === player.name) {
      handleVisitOwnTile(board, updateGameState);
      return;
    }

    // Normal move - delegate to afterMoveLogic (buy/fee/fight/auto-end)
    afterMoveLogic(board, updateGameState);
  };

  continueTileLogic();
}
