import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import {
  Cost,
  Resource,
  exchangeBatch,
  exchangeResource,
  harvestBuyPrice,
  harvestSellPrice,
  maxExchangeBatches,
  scaleCost,
  tradeResource,
  unitCost,
} from '../game/resources';
import { getCharacterConfig } from './decisions';
import { planTurnHire, TurnHire, Wallet } from './botPlans';

export type HarvestTrade =
  | { kind: 'trade'; resource: Resource; amount: number } // + buy, - sell
  | { kind: 'exchange'; from: Resource; batches: number };

// Balancing only kicks in once the richest pile is this many times the poorest.
const BALANCE_RATIO = 1.5;

const other = (r: Resource): Resource => (r === 'food' ? 'arms' : 'food');

export function applyHarvestTrade(wallet: Wallet, t: HarvestTrade): void {
  if (t.kind === 'trade') tradeResource(wallet, t.resource, t.amount);
  else exchangeResource(wallet, t.from, t.batches);
}

/**
 * A bot's Harvest, as trades only -- units are hired on its next turn (see
 * planTurnHire), so this prepares the resources that hire will use:
 * 1. trade so the next turn can hire more units, riders first;
 * 2. (not the Farmer) balance gold/food/arms by gold value;
 * 3. (Wizard) lean toward the resource with the weaker yearly income.
 * Food and arms move between each other by exchange, which beats selling
 * and buying both ways.
 */
export function planHarvestTrades(player: Player, board: GameState): HarvestTrade[] {
  const cfg = getCharacterConfig(player);
  if (!cfg) return [];

  const wallet: Wallet = { gold: player.gold, food: player.food, arms: player.arms };
  const trades: HarvestTrade[] = [];
  const run = (list: HarvestTrade[]) => {
    for (const t of list) {
      applyHarvestTrade(wallet, t);
      trades.push(t);
    }
  };

  run(tradesToHireMore(player, board, wallet));
  if (cfg.id !== 'explorer') run(balanceTrades(wallet, planTurnHire(player, board, wallet).cost));
  if (cfg.id === 'wizard') run(wizardIncomeTrades(player, wallet, planTurnHire(player, board, wallet).cost));
  return trades;
}

function units(h: TurnHire): number {
  return h.riders + h.militia;
}

function costOf(riders: number, militia: number): Cost {
  const r = scaleCost(unitCost('riders'), riders);
  const m = scaleCost(unitCost('militia'), militia);
  return { gold: r.gold + m.gold, food: r.food + m.food, arms: r.arms + m.arms };
}

/** Adds one unit at a time (riders, then militia) for as long as some
 * trades make it affordable on the next turn's hire. Stops on its own once
 * past planTurnHire's own priority target (see botPlans.ts) -- this never
 * pushes a bot to hire more than that, it only funds reaching it sooner. */
function tradesToHireMore(player: Player, board: GameState, wallet: Wallet): HarvestTrade[] {
  let w = { ...wallet };
  const done: HarvestTrade[] = [];
  const tiers: UnitTier[] = player.isKnight ? ['riders', 'militia'] : ['militia'];

  for (const tier of tiers) {
    for (let guard = 0; guard < 500; guard++) {
      const hire = planTurnHire(player, board, w);
      if (hire[tier] >= player.armyRoom(tier)) break;

      const riders = hire.riders + (tier === 'riders' ? 1 : 0);
      const militia = hire.militia + (tier === 'militia' ? 1 : 0);
      const plan = tradesToFund(w, costOf(riders, militia));
      if (!plan) break;

      const trial = { ...w };
      plan.forEach((t) => applyHarvestTrade(trial, t));
      if (units(planTurnHire(player, board, trial)) < riders + militia) break;

      w = trial;
      plan.forEach((t) => pushMerged(done, t));
    }
  }

  return done;
}

/** Folds a trade into an identical-kind neighbour so the plan reads as a few big moves. */
function pushMerged(list: HarvestTrade[], t: HarvestTrade): void {
  const last = list[list.length - 1];
  if (last?.kind === 'exchange' && t.kind === 'exchange' && last.from === t.from) last.batches += t.batches;
  else if (last?.kind === 'trade' && t.kind === 'trade' && last.resource === t.resource && Math.sign(last.amount) === Math.sign(t.amount))
    last.amount += t.amount;
  else list.push({ ...t });
}

/** The fewest trades after which `need` fits the wallet, or null if nothing can. */
function tradesToFund(wallet: Wallet, need: Cost): HarvestTrade[] | null {
  const w = { ...wallet };
  const list: HarvestTrade[] = [];
  const push = (t: HarvestTrade) => {
    applyHarvestTrade(w, t);
    list.push(t);
  };

  const short = (r: Resource) => Math.max(0, need[r] - w[r]);
  const excess = (r: Resource) => Math.max(0, w[r] - need[r]);

  for (const r of ['food', 'arms'] as Resource[]) {
    const from = other(r);
    const { give, get } = exchangeBatch(from);
    const batches = Math.min(Math.ceil(short(r) / get), Math.floor(excess(from) / give));
    if (batches > 0) push({ kind: 'exchange', from, batches });
  }

  const buyCost = short('food') * harvestBuyPrice('food') + short('arms') * harvestBuyPrice('arms');
  let gap = need.gold + buyCost - w.gold;

  const sellOrder = (['food', 'arms'] as Resource[]).sort(
    (a, b) => excess(b) * harvestSellPrice(b) - excess(a) * harvestSellPrice(a)
  );
  for (const r of sellOrder) {
    if (gap <= 0) break;
    const n = Math.min(excess(r), Math.ceil(gap / harvestSellPrice(r)));
    if (n > 0) {
      push({ kind: 'trade', resource: r, amount: -n });
      gap -= n * harvestSellPrice(r);
    }
  }

  if (gap > 0) return null;
  for (const r of ['food', 'arms'] as Resource[]) {
    if (short(r) > 0) push({ kind: 'trade', resource: r, amount: short(r) });
  }

  return list;
}

type Pile = 'gold' | Resource;

const valueOf = (pile: Pile, amount: number) => (pile === 'gold' ? amount : amount * harvestSellPrice(pile));

function free(wallet: Wallet, reserved: Cost): Record<Pile, number> {
  return {
    gold: Math.max(0, wallet.gold - reserved.gold),
    food: Math.max(0, wallet.food - reserved.food),
    arms: Math.max(0, wallet.arms - reserved.arms),
  };
}

/** Moving `value` (in gold, at sell price) out of `from` into `to`. */
function move(from: Pile, to: Pile, value: number, available: number): HarvestTrade | null {
  if (from === 'gold') {
    const n = Math.floor(Math.min(value, available) / harvestBuyPrice(to as Resource));
    return n > 0 ? { kind: 'trade', resource: to as Resource, amount: n } : null;
  }

  const units = Math.min(available, Math.floor(value / harvestSellPrice(from)));
  if (to === 'gold') return units > 0 ? { kind: 'trade', resource: from, amount: -units } : null;
  const batches = Math.floor(units / exchangeBatch(from).give);
  return batches > 0 ? { kind: 'exchange', from, batches } : null;
}

/** Richest pile -> poorest, half the gap in gold value, once it is lopsided. */
function balanceTrades(wallet: Wallet, reserved: Cost): HarvestTrade[] {
  const f = free(wallet, reserved);
  // Resources ahead of gold, so a tie for poorest picks the resource.
  const piles: Pile[] = ['food', 'arms', 'gold'];
  const val = (p: Pile) => valueOf(p, f[p]);
  const richest = piles.reduce((a, b) => (val(b) > val(a) ? b : a));
  const poorest = piles.reduce((a, b) => (val(b) < val(a) ? b : a));
  if (richest === poorest || val(richest) <= 0 || val(richest) < BALANCE_RATIO * val(poorest)) return [];

  const t = move(richest, poorest, (val(richest) - val(poorest)) / 2, f[richest]);
  return t ? [t] : [];
}

/** Wizard: feed the poorer of food/arms when it also earns less a year. */
function wizardIncomeTrades(player: Player, wallet: Wallet, reserved: Cost): HarvestTrade[] {
  const f = free(wallet, reserved);
  const income = player.lastYearIncome ?? { gold: 0, food: 0, arms: 0, units: 0 };
  const fV = valueOf('food', f.food);
  const aV = valueOf('arms', f.arms);
  const from: Resource | null =
    fV > aV && income.arms < income.food ? 'food' : aV > fV && income.food < income.arms ? 'arms' : null;
  if (!from) return [];

  const t = move(from, other(from), Math.abs(fV - aV) / 2, f[from]);
  return t && t.kind === 'exchange' && t.batches <= maxExchangeBatches(wallet, from) ? [t] : [];
}
