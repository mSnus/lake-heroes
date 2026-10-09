import { GameState } from './GameState';
import { TURNS_PER_YEAR } from './constants';

/**
 * The calendar's low-level arithmetic plus the YearEffect query primitives
 * -- split out from game/year.ts (which owns the actual rollover, startNewYear)
 * so that income.ts can read an active effect without a cycle: year.ts
 * itself depends on income.ts (the yearly tile bonus reuses
 * collectTileTurnIncome), so income.ts has to reach the query side through
 * this lower module instead of year.ts directly. Everything here is
 * re-exported from game/year.ts, so every existing `from '../game/year'`
 * import keeps working unchanged.
 */

/** board.round IS the go-round's own number, counting from 1. Nothing
 * calls beginTurn for the game's very first turn (it only ever runs from
 * endTurn, for the turn after), so round sits at its initial 1 for the
 * whole opening go-round and is bumped at the top of each one after. */
function goRound(round: number): number {
  return Math.max(1, round);
}

export function yearForRound(round: number): number {
  return Math.floor((goRound(round) - 1) / TURNS_PER_YEAR) + 1;
}

/** Which turn of its year a round falls on, 1..TURNS_PER_YEAR. */
export function yearTurnForRound(round: number): number {
  return ((goRound(round) - 1) % TURNS_PER_YEAR) + 1;
}

export function currentYear(board: GameState): number {
  return yearForRound(board.round);
}

export function currentYearTurn(board: GameState): number {
  return yearTurnForRound(board.round);
}

/** Something in force for a stretch of the calendar rather than instantly
 * -- a royal decree, a plague that suppresses income for the rest of the
 * year. Plain data so it rides through the save and the multiplayer
 * envelope untouched, exactly like GameState.kingsContracts. */
export interface YearEffect {
  /** What this effect is -- the key consumers check for. */
  id: string;
  /** Last year it applies to, inclusive. */
  untilYear: number;
  /** Optional target, e.g. the tile group a decree singles out. */
  group?: string;
}

export function addYearEffect(board: GameState, effect: YearEffect): void {
  board.yearEffects.push(effect);
}

/** `group`, when given, also requires the matching effect's own `group` to
 * be exactly this -- for a group-targeted effect like DOUBLE_INCOME_EFFECT,
 * which can be in force for some groups and not others at once. Omit it to
 * match any effect with this id regardless of group (board-wide effects
 * like NO_GOLD_INCOME_EFFECT never set one). */
export function hasYearEffect(board: GameState, id: string, group?: string): boolean {
  const year = currentYear(board);
  return board.yearEffects.some(
    (e) => e.id === id && e.untilYear >= year && (group === undefined || e.group === group)
  );
}

/** Drop what the new year has outlived. Reads stay correct without this
 * (they check untilYear themselves) -- this just stops the list growing
 * forever. */
export function expireYearEffects(board: GameState): void {
  const year = currentYear(board);
  board.yearEffects = board.yearEffects.filter((e) => e.untilYear >= year);
}

// Board-wide: Joker's Taxes/Plague, in force for the rest of the year they
// fire in (see actions/joker.ts, income.ts's tileTurnIncome).
export const NO_GOLD_INCOME_EFFECT = 'no-gold-income';
export const NO_UNIT_INCOME_EFFECT = 'no-unit-income';
// Group-targeted: this year's lucky groups, rolled fresh in startNewYear.
export const DOUBLE_INCOME_EFFECT = 'double-income';
