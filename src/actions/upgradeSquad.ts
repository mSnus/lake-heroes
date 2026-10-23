import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { getOverrides } from '../utils/overridesStore';
import { Player } from '../game/Player';
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

/** The largest upgrade no bigger than `wanted` that the militia on hand and
 * the rider cap allow. */
export function maxUpgradable(player: Player, wanted: number): number {
  return Math.max(0, Math.min(wanted, player.militia, player.armyRoom('riders')));
}

/**
 * Converts `count` militia into the same number of riders, for
 * upgradeSquadCost(count) gold. Clamped by maxUpgradable and to what the
 * player can afford.
 */
export function upgradeSquad(
  board: GameState | null,
  count: number,
  updateGameState: (board: GameState) => void,
  pricePerUnit?: number
) {
  if (!board || count <= 0) return;

  const player = board.activePlayer;
  const upgraded = maxUpgradable(player, count);
  const cost = upgradeSquadCost(upgraded, pricePerUnit);

  if (upgraded <= 0 || player.gold < cost) return;

  player.militia -= upgraded;
  player.riders += upgraded;
  player.gold -= cost;

  say(t('armyDisplay.upgraded', { playerName: player.name, amount: upgraded, gold: cost }), 'success');
  updateGameState(board);
}
