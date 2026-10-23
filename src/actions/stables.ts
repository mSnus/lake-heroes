import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import { upgradeSquad } from './upgradeSquad';
import StablesModal from '../components/screens/StablesModal';
import { getOverrides } from '../utils/overridesStore';
import { planArmyPurchase } from '../ai/botPlans';
import { narrate } from '../utils/say';
import { t } from '../i18n';
import { tavernMilitiaPrice, tavernRiderPrice, tavernUpgradePricePerUnit } from './tavern';

export const STABLES_RIDERS_MIN = 3;
export const STABLES_RIDERS_MAX = 12;

function rollStablesRiders(): number {
  return Math.floor(Math.random() * (STABLES_RIDERS_MAX - STABLES_RIDERS_MIN + 1)) + STABLES_RIDERS_MIN;
}

export function handleStables(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  console.log('Action: stables');

  const player = board.activePlayer;
  const riderPrice = getOverrides().riderPrice;
  const rolled = rollStablesRiders();
  const playerSpan = `<span style="color:${player.color}">${player.name}</span>`;

  let lines: string[] = [];

  if (!player.isKnight) {
    // Non-knights can't ride — sell all horses at standard price
    const goldGained = rolled * riderPrice;
    player.gold += goldGained;
    lines.push(t('stables.noKnight', { units: rolled, gold: goldGained, playerSpan }));
    narrate(t('stables.narrateSold', { playerName: player.name, units: rolled, gold: goldGained }));
  } else {
    // Whatever the rider cap can't take is sold.
    const added = player.gainRiders(rolled);
    const remainder = rolled - added;

    if (added > 0) {
      lines.push(t('stables.ridersJoined', { units: added, playerSpan }));
    }

    if (remainder > 0) {
      const goldGained = remainder * riderPrice;
      player.gold += goldGained;
      lines.push(t('stables.overflow', { units: remainder, gold: goldGained }));
    }

    narrate(
      added > 0
        ? t('stables.narrateRiders', { playerName: player.name, units: added })
        : t('stables.narrateNone', { playerName: player.name })
    );
  }

  const joinedHtml = lines.join('<br />');
  updateGameState(board);

  if (isHeadlessRun()) {
    const steps = planArmyPurchase(player, { militiaPrice: tavernMilitiaPrice(), riderPrice: tavernRiderPrice() }, { ridersOnly: true });
    for (const step of steps) {
      if (step.kind === 'sell') sellUnits(board, step.count, updateGameState, step.tier);
      else if (step.kind === 'upgrade') upgradeSquad(board, step.count, updateGameState, tavernUpgradePricePerUnit());
      else buyUnits(board, step.count, updateGameState, step.tier, step.tier === 'riders' ? tavernRiderPrice() : tavernMilitiaPrice());
    }

    setEndTurn();
    return;
  }

  showScreen({
    screenType: 'stables-result',
    content: React.createElement(StablesModal, {
      gameState: board,
      joinedHtml,
      militiaPrice: tavernMilitiaPrice(),
      riderPrice: tavernRiderPrice(),
      onBuy: (amount, tier) => {
        buyUnits(board, amount, updateGameState, tier, tier === 'riders' ? tavernRiderPrice() : tavernMilitiaPrice());
      },
      onSell: (tier, amount) => {
        sellUnits(board, amount, updateGameState, tier);
      },
      onUpgrade: (count) => {
        upgradeSquad(board, count, updateGameState, tavernUpgradePricePerUnit());
      },
      onSkip: () => {
        clearScreen();
        setEndTurn();
      },
    }),
  });
}

export function openStablesHireOnly(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  console.log('Action: reopen stables (hire only)');

  showScreen({
    screenType: 'stables-result',
    content: React.createElement(StablesModal, {
      gameState: board,
      militiaPrice: tavernMilitiaPrice(),
      riderPrice: tavernRiderPrice(),
      onBuy: (amount, tier) => {
        buyUnits(board, amount, updateGameState, tier, tier === 'riders' ? tavernRiderPrice() : tavernMilitiaPrice());
      },
      onSell: (tier, amount) => {
        sellUnits(board, amount, updateGameState, tier);
      },
      onUpgrade: (count) => {
        upgradeSquad(board, count, updateGameState, tavernUpgradePricePerUnit());
      },
      onSkip: () => {
        clearScreen();
        setEndTurn();
      },
    }),
  });
}
