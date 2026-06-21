import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { FeeOptions } from '../actions/feeOptions';
import { syndicateMultiplier } from '../game/syndicate';

export type WizardGuardsAction =
  | { kind: 'pay' }
  | { kind: 'fight' }
  | { kind: 'sell-one-then-fight'; tile: Tile }
  | { kind: 'sell-one-then-pay'; tile: Tile }
  | { kind: 'sell-multiple-then-pay' }
  | { kind: 'accept-loss' };

/**
 * Owned tiles ordered "cheapest to give up first": tiles that aren't part of
 * a completed syndicate (so selling them doesn't break an active 2x bonus)
 * come first, sorted by ascending current bonus value within each group.
 * Syndicate tiles are sold only as a last resort.
 */
export function sortTilesBySacrifice(board: GameState, player: Player): Tile[] {
  const owned = player.ownedTiles
    .map((idx) => board.tiles[idx])
    .filter((t): t is Tile => !!t && t.owner === player.id);

  const isSyndicateTile = (t: Tile) => syndicateMultiplier(board, player, t.group) > 1;

  return [...owned].sort((a, b) => {
    const aSyn = isSyndicateTile(a) ? 1 : 0;
    const bSyn = isSyndicateTile(b) ? 1 : 0;
    if (aSyn !== bSyn) return aSyn - bSyn;
    return a.getBonus(a.level) - b.getBonus(b.level);
  });
}

export function pickWizardGuardsAction(
  board: GameState,
  player: Player,
  tile: Tile,
  opts: FeeOptions
): WizardGuardsAction {
  if (opts.canPay && opts.canFight) {
    if (opts.fee < 0.25 * player.gold) return { kind: 'pay' };
    if (player.units >= 1.5 * opts.defence) return { kind: 'fight' };
    const ownsGroupTile = player.ownedTiles.some((idx) => {
      const t = board.tiles[idx];
      return t && t.owner === player.id && t.group === tile.group;
    });
    if (ownsGroupTile) return { kind: 'fight' };
    return { kind: 'pay' };
  }

  if (opts.canPay) return { kind: 'pay' };
  if (opts.canFight) return { kind: 'fight' };

  const bySacrifice = sortTilesBySacrifice(board, player);

  for (const t of bySacrifice) {
    if (player.units + t.currentPrice.units >= opts.defence) {
      return { kind: 'sell-one-then-fight', tile: t };
    }
  }
  for (const t of bySacrifice) {
    if (player.gold + t.currentPrice.gold >= opts.fee) {
      return { kind: 'sell-one-then-pay', tile: t };
    }
  }
  if (opts.canSell) return { kind: 'sell-multiple-then-pay' };

  return { kind: 'accept-loss' };
}
