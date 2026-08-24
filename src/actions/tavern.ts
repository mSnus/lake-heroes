import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import TavernModal from '../components/TavernModal';
import { computeSlotsUsed } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { planUnitHire } from '../ai/botPlans';
import { t } from '../i18n';

// A Knight's tavern luck sometimes comes as free horses instead of foot
// soldiers — converting existing militia to riders rather than granting new
// militia.
const KNIGHT_HORSE_CHANCE = 0.2;

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
  const playerSpan = `<span style="color:${player.color}">${player.name}</span>`;

  const wantsHorses =
    player.isKnight && player.militia >= unitsReward && Math.random() < KNIGHT_HORSE_CHANCE;

  let joinedMsg: string;
  let fullNote = '';

  if (wantsHorses) {
    const fitsDirectly =
      computeSlotsUsed(player.militia - unitsReward, player.riders + unitsReward) <= player.armySlots;

    if (fitsDirectly) {
      player.militia -= unitsReward;
      player.riders += unitsReward;
      joinedMsg = t('tavern.horsesJoined', { units: unitsReward, playerSpan });
    } else {
      // No room to grow riders even after freeing space by removing the
      // rolled amount from militia — sacrifice one whole militia slot's
      // worth instead (even 10🧍 become 1🐎 if that's all that was rolled)
      // and replace it with the rolled amount of riders; whatever's left
      // over from that slot is lost.
      const sacrificed = Math.min(getOverrides().armySlotCapacity, player.militia);
      player.militia -= sacrificed;
      const ridersAdded = player.gainRiders(unitsReward);
      const leftDrunk = sacrificed - ridersAdded;
      joinedMsg = t('tavern.horsesJoined', { units: ridersAdded, playerSpan });
      if (leftDrunk > 0) {
        fullNote = t('tavern.leftDrunk', { units: leftDrunk });
      }
    }
  } else {
    const gained = player.gainMilitia(unitsReward);
    const turnedAway = unitsReward - gained;

    if (gained > 0) {
      joinedMsg = t('tavern.joined', { units: gained, playerSpan });
      if (turnedAway > 0) {
        fullNote = t('tavern.fullNote', { used: player.slotsUsed, total: player.armySlots, turnedAway });
      }
    } else {
      joinedMsg = t('tavern.ranksFull', { units: unitsReward });
    }
  }

  updateGameState(board);

  // Same decision TavernModal's own self-drive effect makes.
  if (isHeadlessRun()) {
    const { amount: hireAmount } = planUnitHire(player, 'militia');
    if (hireAmount > 0) buyUnits(board, hireAmount, updateGameState, 'militia');
    setEndTurn();
    return;
  }

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

/**
 * Reopen the Tavern's hire dialogue for a player already standing on it, with
 * no dice roll and no free-units bonus -- just recruiting. Covers clicking
 * the tile again after a page reload lost the original post-roll screen (the
 * roll itself only ever happens once, from rollAndMove landing on the tile).
 */
export function openTavernHireOnly(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  console.log('Action: reopen tavern (hire only)');

  showScreen({
    screenType: 'tavern-result',
    content: React.createElement(TavernModal, {
      gameState: board,
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
