import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import { upgradeSquad } from './upgradeSquad';
import TavernModal from '../components/screens/TavernModal';
import { getOverrides } from '../utils/overridesStore';
import { planArmyPurchase } from '../ai/botPlans';
import { TAVERN_PRICE_MULT } from '../game/constants';
import { currentYear } from '../game/year';
import { narrate } from '../utils/say';
import { t } from '../i18n';

// A Knight's tavern luck sometimes comes as free horses instead of foot
// soldiers — converting existing militia to riders rather than granting new
// militia.
const KNIGHT_HORSE_CHANCE = 0.2;

const TAVERN_UNITS_MIN = 3;
const TAVERN_UNITS_MAX = 12;

/** The Tavern's militia/rider hire prices -- a premium over the King's
 * Castle's own prices, shared by the human hire panel, the bot decision,
 * and the actual charge so none of them can ever drift apart. */
export function tavernMilitiaPrice(): number {
  return getOverrides().militiaPrice * TAVERN_PRICE_MULT;
}

export function tavernRiderPrice(): number {
  return getOverrides().riderPrice * TAVERN_PRICE_MULT;
}

/** Per-unit cost to upgrade militia into riders at the Tavern's premium
 * rates -- both tiers scale by the same multiplier, so this is just the
 * normal upgrade delta times TAVERN_PRICE_MULT. */
export function tavernUpgradePricePerUnit(): number {
  return tavernRiderPrice() - tavernMilitiaPrice();
}

export function handleTavern(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: tavern');

  const player = board.activePlayer;

  const years = currentYear(board);
  const yearMultiplier = years >= 12 ? 2 : years >= 6 ? 1.5 : 1;
  const baseRoll = Math.floor(Math.random() * (TAVERN_UNITS_MAX - TAVERN_UNITS_MIN + 1)) + TAVERN_UNITS_MIN;
  const unitsReward = Math.round(baseRoll * yearMultiplier);
  void roll; // dice animation still plays for atmosphere
  const playerSpan = `<span style="color:${player.color}">${player.name}</span>`;

  // Free horses turn militia already in the army into riders, as far as the
  // rider cap allows.
  const horsed =
    player.isKnight && player.militia >= unitsReward && Math.random() < KNIGHT_HORSE_CHANCE
      ? Math.min(unitsReward, player.armyRoom('riders'))
      : 0;

  let joinedMsg: string;
  let fullNote = '';

  if (horsed > 0) {
    player.militia -= horsed;
    player.riders += horsed;
    joinedMsg = t('tavern.horsesJoined', { units: horsed, playerSpan });
    narrate(t('tavern.narrateHorses', { playerName: player.name, units: horsed }));
  } else {
    const gained = player.gainMilitia(unitsReward);
    const turnedAway = unitsReward - gained;

    if (gained > 0) {
      joinedMsg = t('tavern.joined', { units: gained, playerSpan });
      if (turnedAway > 0) {
        fullNote = t('tavern.fullNote', { used: player.militia, total: player.armyCapacity.militia, turnedAway });
      }

      narrate(t('tavern.narrateMilitia', { playerName: player.name, units: gained }));
    } else {
      joinedMsg = t('tavern.ranksFull', { units: unitsReward });
      narrate(t('tavern.narrateEmpty', { playerName: player.name }));
    }
  }

  updateGameState(board);

  // Same decision TavernModal's own self-drive effect makes.
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
    screenType: 'tavern-result',
    content: React.createElement(TavernModal, {
      gameState: board,
      joinedHtml: `${joinedMsg}${fullNote}`,
      onSkip: () => {
        clearScreen();
        setEndTurn();
      },
    }),
  });
}
