import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { UnitTier, UNIT_POWER, computeArmyPower } from '../game/army';
import { BOT_ARMY_FILL_FRACTION } from '../game/constants';
import { getOverrides } from '../utils/overridesStore';
import { Cost, hireMax, maxAffordable, scaleCost, unitCost, upgradeCost } from '../game/resources';
import { getCharacterConfig, pickKingsCastleHireAmount, pickKingsCastleHireTier } from './decisions';

/**
 * Bot plans that used to live inside screen components' useEffects, which made
 * them unreachable without rendering. Pulled out so the live game and the
 * headless economy simulator decide identically -- the same drift trap the
 * battle simulator fell into.
 */

/** What a bot buys at the King's Castle (any tier) or the Tavern (militia,
 * with priceOverride set to the Tavern's own premium price -- see
 * tavern.ts's tavernMilitiaPrice). */
export function planUnitHire(
  player: Player,
  forcedTier?: UnitTier,
  priceOverride?: number
): { tier: UnitTier; amount: number } {
  const tier = forcedTier ?? pickKingsCastleHireTier(player);
  const ov = getOverrides();
  const price = priceOverride ?? (tier === 'riders' ? ov.riderPrice : ov.militiaPrice);
  const maxAmount = hireMax(player, tier, price);
  return { tier, amount: pickKingsCastleHireAmount(player, maxAmount, price) };
}

/** One move in a bot's shopping trip at the King's Castle (or the Tavern,
 * with its own premium prices -- see PriceOverrides). */
export type ArmyStep =
  | { kind: 'sell'; tier: UnitTier; count: number }
  | { kind: 'hire'; tier: UnitTier; count: number }
  | { kind: 'upgrade'; count: number };

/** Overrides both unit prices at once -- the Tavern charges its own premium
 * rate for militia AND riders (see tavern.ts's tavernMilitiaPrice/
 * tavernRiderPrice), unlike planUnitHire's single-tier priceOverride. */
export interface PriceOverrides {
  militiaPrice: number;
  riderPrice: number;
}

/**
 * A Knight bot spends its way toward riders, the stronger tier:
 *
 * 1. Any spare rider cap gets filled with fresh hires, as far as gold allows.
 * 2. Then militia on hand are upgraded in place (cheaper per rider than a
 *    fresh hire), as far as gold and the rider cap allow.
 *
 * Same for every character -- there's no rider-shy personality. Non-Knights
 * can't recruit riders at all, so they fall through to militia.
 */
function planRiderBuildUp(player: Player, prices: PriceOverrides): ArmyStep[] {
  if (!player.isKnight) return [];

  const wallet = { gold: player.gold, food: player.food, arms: player.arms };
  let riderRoom = player.armyRoom('riders');
  const steps: ArmyStep[] = [];

  const riderCost = unitCost('riders', prices.riderPrice);
  const hired = Math.min(maxAffordable(wallet, riderCost), riderRoom);
  if (hired > 0) {
    steps.push({ kind: 'hire', tier: 'riders', count: hired });
    const paid = scaleCost(riderCost, hired);
    wallet.gold -= paid.gold;
    wallet.food -= paid.food;
    wallet.arms -= paid.arms;
    riderRoom -= hired;
  }

  const upgraded = Math.min(
    player.militia,
    riderRoom,
    maxAffordable(wallet, upgradeCost(prices.riderPrice - prices.militiaPrice))
  );
  if (upgraded > 0) steps.push({ kind: 'upgrade', count: upgraded });

  return steps;
}

/**
 * The bot's whole shopping trip at the King's Castle (or the Tavern, passing
 * its own premium prices), in order. Riders first (see planRiderBuildUp); a
 * bot that can't or shouldn't buy riders tops up militia the way it always
 * did (unless `ridersOnly`). `prices` defaults to the normal King's Castle
 * prices.
 */
export function planArmyPurchase(
  player: Player,
  prices?: PriceOverrides,
  opts: { ridersOnly?: boolean } = {}
): ArmyStep[] {
  const ov = getOverrides();
  const resolvedPrices = prices ?? { militiaPrice: ov.militiaPrice, riderPrice: ov.riderPrice };
  const riderSteps = planRiderBuildUp(player, resolvedPrices);
  if (riderSteps.length > 0) return riderSteps;
  // The Stables sells riders only, so there is no militia to top up with.
  if (opts.ridersOnly) return [];

  const { tier, amount } = planUnitHire(player, 'militia', resolvedPrices.militiaPrice);
  return amount > 0 ? [{ kind: 'hire', tier, count: amount }] : [];
}

export type Wallet = Pick<Player, 'gold' | 'food' | 'arms'>;

export interface TurnHire {
  riders: number;
  militia: number;
  cost: Cost;
}

/** The weakest garrison among tiles any player could claim right now
 * (ownable, discovered, unowned) -- 0 if there are none left. Same number
 * `tile.isAffordable`/`shouldClaimTile` compare armyPower against for that
 * tile (getDefence() ignores its level argument for an unowned tile, so
 * there's no level-2/3 case to worry about here). */
function weakestAvailableTileDefence(board: GameState): number {
  const available = board.tiles.filter(
    (t): t is Tile => !!t && t.isOwnable && !t.isOwned() && !t.fog
  );
  return available.length > 0 ? Math.min(...available.map((t) => t.getDefence())) : 0;
}

/**
 * What a bot hires at the start of every turn, at King's Castle prices, by
 * priority (same for every character -- no personality split here):
 *
 * 1. Enough army power to beat the weakest tile still up for grabs anywhere
 *    on the map, riders first (better power per gold for a Knight) then
 *    militia for the rest.
 * 2. Short of that, fill each tier toward BOT_ARMY_FILL_FRACTION of its own
 *    Fame cap -- riders, then militia.
 * 3. Nothing further: whatever gold is left banks toward the cheapest
 *    available tile (see decisions.ts's shouldClaimTile, which spends it).
 */
export function planTurnHire(player: Player, board: GameState, wallet: Wallet = player): TurnHire {
  const left = { gold: wallet.gold, food: wallet.food, arms: wallet.arms };
  const held = { militia: player.militia, riders: player.riders };
  const cap = player.armyCapacity;
  const hired = { militia: 0, riders: 0 };

  const buy = (tier: UnitTier, desired: number): void => {
    if (desired <= 0) return;
    const cost = unitCost(tier);
    const room = Math.max(0, cap[tier] - held[tier] - hired[tier]);
    const n = Math.min(Math.ceil(desired), room, maxAffordable(left, cost));
    if (n <= 0) return;
    const paid = scaleCost(cost, n);
    left.gold -= paid.gold;
    left.food -= paid.food;
    left.arms -= paid.arms;
    hired[tier] += n;
  };

  const powerGap = () =>
    Math.max(0, weakestAvailableTileDefence(board) - computeArmyPower(held.militia + hired.militia, held.riders + hired.riders));

  if (player.isKnight) buy('riders', powerGap() / UNIT_POWER.riders);
  buy('militia', powerGap() / UNIT_POWER.militia);

  if (player.isKnight) buy('riders', Math.floor(cap.riders * BOT_ARMY_FILL_FRACTION) - held.riders - hired.riders);
  buy('militia', Math.floor(cap.militia * BOT_ARMY_FILL_FRACTION) - held.militia - hired.militia);

  const cost = {
    gold: wallet.gold - left.gold,
    food: wallet.food - left.food,
    arms: wallet.arms - left.arms,
  };
  return { riders: hired.riders, militia: hired.militia, cost };
}

/** How many militia a bot leaves guarding a tile it has just claimed. */
export function planClaimGarrison(
  player: Player,
  maxGarrison: number,
  totalMilitiaPool: number
): number {
  const fraction = getCharacterConfig(player)?.claimGarrisonFraction ?? 0;
  return Math.min(maxGarrison, Math.floor(fraction * totalMilitiaPool));
}
