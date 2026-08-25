import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { getOverrides } from '../utils/overridesStore';
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
 * Converts `count` militia into the same number of riders, for
 * upgradeSquadCost(count) gold — same army slot either way (a whole
 * displayed chunk's worth moves from one tier to the other, which never
 * changes total slots used, see army.ts's computeSlotsUsed), so no
 * capacity check is needed beyond having the gold.
 */
export function upgradeSquad(
  board: GameState | null,
  count: number,
  updateGameState: (board: GameState) => void,
  pricePerUnit?: number
) {
  if (!board || count <= 0) return;

  const player = board.activePlayer;
  const upgraded = Math.min(count, player.militia);
  const cost = upgradeSquadCost(upgraded, pricePerUnit);

  if (upgraded <= 0 || player.gold < cost) return;

  player.militia -= upgraded;
  player.riders += upgraded;
  player.gold -= cost;

  say(t('squadDisplay.upgraded', { playerName: player.name, amount: upgraded, gold: cost }), 'success');
  updateGameState(board);
}
