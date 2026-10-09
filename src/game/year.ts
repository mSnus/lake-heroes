import { GameState } from './GameState';
import { TURNS_PER_YEAR } from './constants';
import { changeKarma } from '../utils/karma';
import { collectTileTurnIncome } from './income';
import { say } from '../utils/say';
import { t } from '../i18n';

/**
 * The shared calendar. Unlike a player's own `circles` (laps of the board,
 * which still drive the King's Grace payout), this runs at the same rate
 * for everyone: one year per TURNS_PER_YEAR go-rounds.
 *
 * It is derived from board.round rather than stored, so there is no second
 * counter to drift out of sync with the turn order, and a save from before
 * the calendar existed still reads a sensible year. board.round is bumped
 * in beginTurn the moment the last player's turn ends -- before the
 * prison-skip check, so a turn spent in jail passes the time like any
 * other.
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

export function hasYearEffect(board: GameState, id: string): boolean {
  const year = currentYear(board);
  return board.yearEffects.some((e) => e.id === id && e.untilYear >= year);
}

/** Drop what the new year has outlived. Reads stay correct without this
 * (they check untilYear themselves) -- this just stops the list growing
 * forever. */
export function expireYearEffects(board: GameState): void {
  const year = currentYear(board);
  board.yearEffects = board.yearEffects.filter((e) => e.untilYear >= year);
}

/**
 * Year rollover: everything that used to ride on each player's own Castle
 * crossing but is now the same clock for all of them. The King's Grace
 * itself deliberately stays on the Castle (see passStart.ts) -- only the
 * calendar moved.
 */
export function startNewYear(board: GameState): void {
  expireYearEffects(board);

  // A one-time bonus from every tile each player owns, on top of whatever
  // they already collected this turn -- same formula as the regular
  // per-turn payout (collectTileTurnIncome), just granted once more for
  // the whole table at once. Silent per player; one shared toast covers
  // the lot, and only if it actually paid out anything (a tileless player,
  // or a table with nobody owning anything yet, pays out nothing to
  // announce).
  let anyBonus = false;
  for (const player of board.players) {
    player.dragonEncounters = 0;
    player.caravanEncounters = 0;
    player.ambushEncounters = 0;
    player.workersEncounters = 0;
    if (player.karma < 0) changeKarma(player, 1);
    else if (player.karma > 0) changeKarma(player, -1);

    const bonus = collectTileTurnIncome(board, player);
    if (bonus.gold > 0 || bonus.units > 0) anyBonus = true;
  }

  if (anyBonus) {
    say(t('year.yearlyBonus'), 'info');
  }
}
