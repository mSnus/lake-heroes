import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import TavernModal from '../components/TavernModal';
import { t } from '../i18n';

export function handleTavern(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: tavern');

  const player = board.activePlayer;

  const circles = player.circles ?? 0;
  const circleMultiplier = circles >= 12 ? 2 : circles >= 6 ? 1.5 : 1;
  const unitsReward = Math.round(roll * circleMultiplier);
  const gained = player.gainMilitia(unitsReward);
  const turnedAway = unitsReward - gained;

  updateGameState(board);

  const playerSpan = `<span style="color:${player.color}">${player.name}</span>`;
  const joinedMsg =
    gained > 0
      ? t('tavern.joined', { units: gained, playerSpan })
      : t('tavern.noneJoined', { playerSpan });
  const fullNote =
    turnedAway > 0
      ? t('tavern.fullNote', { used: player.slotsUsed, total: player.armySlots, turnedAway })
      : '';

  showScreen({
    screenType: 'tavern-result',
    content: React.createElement(TavernModal, {
      gameState: board,
      joinedHtml: `${joinedMsg}${fullNote}`,
      onBuy: (amount, tier) => {
        buyUnits(board, amount, updateGameState, tier);
      },
      onSell: (tier, amount) => {
        sellUnits(board, amount, updateGameState, tier);
      },
      onSkip: () => {
        clearScreen();
        setEndTurn();
      },
    }),
  });
}
