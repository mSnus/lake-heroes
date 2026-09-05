import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { getOverrides } from '../utils/overridesStore';
import { computeSlotsUsed } from '../game/army';
import { t } from '../i18n';

/** Gold cost to upgrade `count` militia into riders — the difference
 * between a rider's price and a militia's, since the militia being
 * converted are already-owned units, not a fresh hire. `pricePerUnit`
 * overrides that difference outright (the Tavern charges its own premium
 * per-unit rate for both tiers -- see tavern.ts's tavernUpgradePricePerUnit). */
export function upgradeSquadCost(count: number, pricePerUnit?: number): number {
  const ov = getOverrides();
  const perUnit = pricePerUnit ?? ov.riderPrice - ov.militiaPrice;
  return Math.max(0, count * perUnit);
}

/**
 * The largest upgrade no bigger than `wanted` that leaves the army inside
 * its slot limit.
 *
 * An upgrade keeps headcount identical but re-splits it across the tiers,
 * and the split is what costs slots: at capacity 12, 2🧍+0🐎 is 1 slot, but
 * upgrading a single one to 1🧍+1🐎 needs 2. Upgrading a *whole displayed
 * chunk* is always safe (the militia side loses exactly one slot and the
 * rider side gains at most one), which is what every current caller passes
 * -- SquadDisplay's button sends chunk.count and botPlans the smallest
 * chunk. This clamp only bites on some other count, and clamps down so it
 * can never charge for more than was asked.
 */
export function maxUpgradable(militia: number, riders: number, slots: number, wanted: number): number {
  for (let u = Math.min(wanted, militia); u > 0; u--) {
    if (computeSlotsUsed(militia - u, riders + u) <= slots) return u;
  }

  return 0;
}

/**
 * Converts `count` militia into the same number of riders, for
 * upgradeSquadCost(count) gold. Clamped to what the army's slots can hold
 * (see maxUpgradable) and to what the player can afford.
 */
export function upgradeSquad(
  board: GameState | null,
  count: number,
  updateGameState: (board: GameState) => void,
  pricePerUnit?: number
) {
  if (!board || count <= 0) return;

  const player = board.activePlayer;
  const upgraded = maxUpgradable(player.militia, player.riders, player.armySlots, count);
  const cost = upgradeSquadCost(upgraded, pricePerUnit);

  if (upgraded <= 0 || player.gold < cost) return;

  player.militia -= upgraded;
  player.riders += upgraded;
  player.gold -= cost;

  say(t('squadDisplay.upgraded', { playerName: player.name, amount: upgraded, gold: cost }), 'success');
  updateGameState(board);
}
