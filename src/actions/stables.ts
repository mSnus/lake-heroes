import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import { upgradeSquad } from './upgradeSquad';
import StablesModal from '../components/StablesModal';
import { slotChunks } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { planArmyPurchase } from '../ai/botPlans';
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
  const overrides = getOverrides();
  const militiaPrice = overrides.militiaPrice;
  const riderPrice = overrides.riderPrice;
  const rolled = rollStablesRiders();
  const playerSpan = `<span style="color:${player.color}">${player.name}</span>`;

  let lines: string[] = [];

  if (!player.isKnight) {
    // Non-knights can't ride — sell all horses at standard price
    const goldGained = rolled * riderPrice;
    player.gold += goldGained;
    lines.push(t('stables.noKnight', { units: rolled, gold: goldGained, playerSpan }));
  } else {
    // Step 1: fit what we can directly into empty/rider slots
    const added = player.gainRiders(rolled);
    let remainder = rolled - added;

    if (added > 0) {
      lines.push(t('stables.ridersJoined', { units: added, playerSpan }));
    }

    // Step 2: sell the smallest militia slot, fill it with riders
    if (remainder > 0 && player.militia > 0) {
      const chunks = slotChunks(player.militia);
      const soldMilitia = Math.min(...chunks);
      player.militia -= soldMilitia;
      const militiaGold = soldMilitia * militiaPrice;
      player.gold += militiaGold;

      const moreAdded = player.gainRiders(remainder);
      remainder -= moreAdded;

      lines.push(t('stables.upgradedSlot', { sold: soldMilitia, received: moreAdded, militiaGold, playerSpan }));
    }

    // Step 3: whatever still doesn't fit → gold
    if (remainder > 0) {
      const goldGained = remainder * riderPrice;
      player.gold += goldGained;
      lines.push(t('stables.overflow', { units: remainder, gold: goldGained }));
    }
  }

  const joinedHtml = lines.join('<br />');
  updateGameState(board);

  if (isHeadlessRun()) {
    const steps = planArmyPurchase(player, { militiaPrice: tavernMilitiaPrice(), riderPrice: tavernRiderPrice() });
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
