import React from 'react';
import { GameState } from '../game/GameState';
import { showScreenWithFog, clearScreen } from '../utils/screenStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { currentYear } from '../game/year';
import { setEndTurn } from '../utils/endTurnStore';
import { planArmyPurchase } from '../ai/botPlans';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import { upgradeSquad } from './upgradeSquad';
import { tavernMilitiaPrice, tavernRiderPrice, tavernUpgradePricePerUnit } from './tavern';
import WorkersModal from '../components/screens/WorkersModal';
import { announce } from '../utils/announce';
import { narrate } from '../utils/say';
import { t } from '../i18n';

/** Same base odds as a caravan. */
const ENCOUNTER_CHANCE = 1 / 12;
/** A player who's held zero units for over a year is twice as likely to
 * run into this -- the whole point of the encounter is to rescue exactly
 * that player, see the module doc below. */
const LONG_TERM_ZERO_MULT = 2;

/**
 * Workers: a free-standing hire opportunity, independent of the Tavern or
 * King's Castle. Exists to rescue a player who has lost their whole army
 * and owns no tiles -- with nothing left to garrison or claim with, they'd
 * otherwise be stuck until they happen to land on the Tavern or get
 * outplayed into irrelevance. Also just another source of units generally.
 *
 * Unlike caravans/ambushes this never fights -- it's a pure hire dialogue
 * (same mechanics and prices as the Tavern's), so there's nothing to force
 * a kind of, only whether it fires at all.
 */
export function checkWorkersEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  force = false
): boolean {
  const player = board.activePlayer;

  // Tracked on every check, whether or not an encounter can actually fire
  // this turn, so "how long has this player held zero units" stays accurate
  // across turns it wasn't even eligible to roll (year 1, already used this
  // year, etc).
  if (player.units > 0) {
    player.zeroUnitsSinceYear = undefined;
  } else if (player.zeroUnitsSinceYear === undefined) {
    player.zeroUnitsSinceYear = currentYear(board);
  }

  if (!force) {
    // No workers during the game's first year.
    if (currentYear(board) <= 1) return false;

    // Max 1 per year.
    if ((player.workersEncounters ?? 0) >= 1) return false;

    const longTermZero =
      player.units === 0 &&
      player.zeroUnitsSinceYear !== undefined &&
      currentYear(board) - player.zeroUnitsSinceYear > 1;
    const chance = longTermZero ? ENCOUNTER_CHANCE * LONG_TERM_ZERO_MULT : ENCOUNTER_CHANCE;
    if (Math.random() >= chance) return false;
  }

  // Encounter!
  player.workersEncounters = (player.workersEncounters ?? 0) + 1;
  updateGameState(board);
  narrate(t('workersEncounter.narrateVisit', { playerName: player.name }));

  // Same decision WorkersModal's own self-drive effect makes.
  if (isHeadlessRun()) {
    const steps = planArmyPurchase(player, { militiaPrice: tavernMilitiaPrice(), riderPrice: tavernRiderPrice() });
    if (steps.length > 0) announce(player, 'botController.hireWorkers');
    for (const step of steps) {
      if (step.kind === 'sell') sellUnits(board, step.count, updateGameState, step.tier);
      else if (step.kind === 'upgrade') upgradeSquad(board, step.count, updateGameState, tavernUpgradePricePerUnit());
      else buyUnits(board, step.count, updateGameState, step.tier, step.tier === 'riders' ? tavernRiderPrice() : tavernMilitiaPrice());
    }

    setEndTurn();
    return true;
  }

  showScreenWithFog({
    screenType: 'workers',
    background: 'assets/screens/caravan.jpg',
    fade: true,
    content: React.createElement(WorkersModal, {
      gameState: board,
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
        onContinue();
      },
    }),
  });

  return true;
}
