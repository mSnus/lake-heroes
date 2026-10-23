import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { Cost, upgradeCost, scaleCost, maxAffordable, pay, formatCost } from '../game/resources';
import { t } from '../i18n';

/** Cost to upgrade `count` militia into riders — the difference between
 * the two recipes, since the militia being converted are already-owned
 * units, not a fresh hire. `pricePerUnit` overrides the gold part of that
 * difference (the Tavern's premium -- see tavern.ts's
 * tavernUpgradePricePerUnit). */
export function upgradeSquadCost(count: number, pricePerUnit?: number): Cost {
  return scaleCost(upgradeCost(pricePerUnit), count);
}

/** The largest upgrade no bigger than `wanted` that the militia on hand,
 * the rider cap and the player's resources allow. */
export function maxUpgradable(player: Player, wanted: number, pricePerUnit?: number): number {
  return Math.max(
    0,
    Math.min(wanted, player.militia, player.armyRoom('riders'), maxAffordable(player, upgradeCost(pricePerUnit)))
  );
}

/**
 * Converts `count` militia into the same number of riders, for
 * upgradeSquadCost(count). Clamped by maxUpgradable, which includes what
 * the player can afford.
 */
export function upgradeSquad(
  board: GameState | null,
  count: number,
  updateGameState: (board: GameState) => void,
  pricePerUnit?: number
) {
  if (!board || count <= 0) return;

  const player = board.activePlayer;
  const upgraded = maxUpgradable(player, count, pricePerUnit);
  if (upgraded <= 0) return;
  const cost = upgradeSquadCost(upgraded, pricePerUnit);

  player.militia -= upgraded;
  player.riders += upgraded;
  pay(player, cost);

  say(t('armyDisplay.upgraded', { playerName: player.name, amount: upgraded, cost: formatCost(cost) }), 'success');
  updateGameState(board);
}
