import { GameState } from './GameState';
import { changeKarma } from '../utils/karma';
import { collectTileTurnIncome } from './income';
import { say } from '../utils/say';
import { t } from '../i18n';
import {
  currentYear,
  currentYearTurn,
  yearForRound,
  yearTurnForRound,
  addYearEffect,
  hasYearEffect,
  expireYearEffects,
  YearEffect,
  NO_GOLD_INCOME_EFFECT,
  NO_UNIT_INCOME_EFFECT,
  DOUBLE_INCOME_EFFECT,
} from './yearCore';
import { DOUBLE_INCOME_GROUPS, DOUBLE_INCOME_CHANCE, DOUBLE_INCOME_MAX_GROUPS } from './constants';

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
 *
 * The arithmetic and the YearEffect query primitives actually live in
 * yearCore.ts (see its own doc comment for why) -- re-exported here so
 * every existing `from '../game/year'` import is unaffected.
 */
export {
  currentYear,
  currentYearTurn,
  yearForRound,
  yearTurnForRound,
  addYearEffect,
  hasYearEffect,
  expireYearEffects,
  NO_GOLD_INCOME_EFFECT,
  NO_UNIT_INCOME_EFFECT,
  DOUBLE_INCOME_EFFECT,
};
export type { YearEffect };

// This year's lucky groups (if any) flash a 🟨/🟪/🟩 badge, chosen per
// group here so income.ts's tileTurnIncome and this announcement can't
// name a group differently.
const GROUP_EMOJI: Record<string, string> = { Mills: '🟨', Farms: '🟪', Fields: '🟩' };

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

  // This year's lucky groups: each of Mills/Farms/Fields independently
  // rolls DOUBLE_INCOME_CHANCE, capped at DOUBLE_INCOME_MAX_GROUPS -- a
  // random one of the extras is dropped rather than the roll order always
  // favoring Mills first. Just expired (above), so this is always a fresh
  // pick, never a holdover from last year.
  let promoted = DOUBLE_INCOME_GROUPS.filter(() => Math.random() < DOUBLE_INCOME_CHANCE);
  while (promoted.length > DOUBLE_INCOME_MAX_GROUPS) {
    promoted = promoted.filter((_, i) => i !== Math.floor(Math.random() * promoted.length));
  }

  for (const group of promoted) {
    addYearEffect(board, { id: DOUBLE_INCOME_EFFECT, untilYear: currentYear(board), group });
  }

  // One shared toast for both year-rollover announcements -- the "lucky
  // groups" sentence reads as a continuation of the bonus one, not a
  // separate event, so they're one message when both have something to say.
  const announcements: string[] = [];
  if (anyBonus) announcements.push(t('year.yearlyBonus'));
  if (promoted.length > 0) {
    const groups = promoted
      .map((g) => `${GROUP_EMOJI[g]} ${t(`year.groupName.${g}`)}`)
      .join(` ${t('common.and')} `);
    announcements.push(t('year.doubleIncomeAnnounce', { groups }));
  }

  if (announcements.length > 0) say(announcements.join(' '), 'info');
}
