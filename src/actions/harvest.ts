import React from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { tradeResource } from '../game/resources';
import { isHeadlessRun } from '../utils/headlessStore';
import { setEndTurn } from '../utils/endTurnStore';
import { showScreen, clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { t } from '../i18n';
import { endTurn } from './endTurn';
import HarvestModal from '../components/screens/HarvestModal';

/** Placeholder bot rule until real ones exist: sell half of each. */
function botHarvest(player: Player): void {
  const food = tradeResource(player, 'food', -Math.floor(player.food / 2));
  const arms = tradeResource(player, 'arms', -Math.floor(player.arms / 2));
  if (food || arms) {
    say(t('harvest.botSold', { playerName: player.name, food: -food, arms: -arms }), 'debug');
  }
}

/** Ends a Harvest turn -- the screen's close button. */
export function finishHarvestTurn(board: GameState, updateGameState: (board: GameState) => void): void {
  clearScreen();
  gameEvent('setPhase', 'before-move');
  endTurn(board, updateGameState);
}

/** Shows the active player's Harvest screen (also used to restore it on reload). */
export function showHarvestScreen(board: GameState, updateGameState: (board: GameState) => void): void {
  showScreen({
    content: React.createElement(HarvestModal, {
      gameState: board,
      updateGameState,
      onClose: () => finishHarvestTurn(board, updateGameState),
    }),
  });
}

/**
 * A player's turn in the Harvest round (see beginTurn): no dice, no move,
 * no tile income -- a human trades on the Harvest screen and ends the turn
 * by closing it; a bot trades by rule and ends it straight away.
 */
export function beginHarvestTurn(board: GameState, updateGameState: (board: GameState) => void): void {
  const player = board.activePlayer;
  board.skippingTurn = false;

  if (player.isComputer || isHeadlessRun()) {
    botHarvest(player);
    updateGameState(board);
    setEndTurn();
    return;
  }

  updateGameState(board);
  showHarvestScreen(board, updateGameState);
}
