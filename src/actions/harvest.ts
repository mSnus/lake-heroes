import React from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { planHarvestTrades, applyHarvestTrade } from '../ai/harvestPlan';
import { isHeadlessRun } from '../utils/headlessStore';
import { setEndTurn } from '../utils/endTurnStore';
import { showScreen, clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { t } from '../i18n';
import { endTurn } from './endTurn';
import HarvestModal from '../components/screens/HarvestModal';

function botHarvest(player: Player): void {
  const before = { gold: player.gold, food: player.food, arms: player.arms };
  for (const trade of planHarvestTrades(player)) applyHarvestTrade(player, trade);

  const parts = (
    [
      ['gold', '🟡'],
      ['food', '🫓'],
      ['arms', '⚔️'],
    ] as const
  )
    .map(([k, emoji]) => [player[k] - before[k], emoji] as const)
    .filter(([d]) => d !== 0)
    .map(([d, emoji]) => `${d > 0 ? '+' : ''}${d}${emoji}`);
  if (parts.length > 0) say(t('harvest.botTraded', { playerName: player.name, summary: parts.join(' ') }), 'debug');
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
