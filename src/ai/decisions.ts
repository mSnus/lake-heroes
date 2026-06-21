import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { CHARACTERS, CharacterConfig } from './characters';
import { FeeOptions } from '../actions/feeOptions';
import { UNIT_PRICE } from '../game/constants';

export function getCharacterConfig(player: Player): CharacterConfig | null {
  return player.character ? CHARACTERS[player.character] : null;
}

/** Should this bot claim the unowned tile it's standing on? */
export function shouldClaimTile(player: Player, tile: Tile): boolean {
  const cfg = getCharacterConfig(player);
  if (!cfg) return false;
  if (!tile.isAffordable(player.gold, player.units, player.fame)) return false;

  if (cfg.claim.type === 'chance') {
    return Math.random() < cfg.claim.chance;
  }

  if (cfg.claim.type === 'afford-no-banzai') {
    // Plain affordability, but reject the banzai exception isAffordable()
    // would otherwise allow (i.e. require the real, non-banzai defence).
    return player.units >= tile.getDefence(1);
  }

  // threshold type (explorer): never banzai — require the plain (non-banzai)
  // defence to be met, then apply the tighter army/gold fractions on top.
  const lvl1Defence = tile.getDefence(1);
  if (player.units < lvl1Defence) return false;
  const armyOk = lvl1Defence <= cfg.claim.armyFraction * player.units;
  const goldOk = tile.prices['1'].gold <= cfg.claim.goldFraction * player.gold;
  return armyOk && goldOk;
}

/**
 * Scan all owned tiles and pick the single best eligible upgrade candidate,
 * or null. "Best" = highest absolute bonus increase, tie-broken by cheapest
 * gold cost.
 */
export function pickUpgradeCandidate(board: GameState, player: Player): Tile | null {
  const cfg = getCharacterConfig(player);
  if (!cfg) return null;

  let best: Tile | null = null;
  let bestBonusGain = -1;

  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile || tile.owner !== player.id || tile.level >= 3) continue;

    const nextLevel = tile.level + 1;
    const price = tile.prices[nextLevel];
    if (!price) continue;

    const goldOk = price.gold <= cfg.upgrade.goldFraction * player.gold;
    const unitsOk = price.units <= cfg.upgrade.unitsFraction * player.units;
    if (!goldOk || !unitsOk) continue;

    const bonusGain = tile.getBonus(nextLevel) - tile.getBonus(tile.level);
    const better =
      bonusGain > bestBonusGain ||
      (bonusGain === bestBonusGain && best !== null && price.gold < best.prices[best.level + 1].gold);

    if (better || best === null) {
      best = tile;
      bestBonusGain = bonusGain;
    }
  }

  return best;
}

/** Hero's Hour: fight the eligible opponent with the fewest units (safest), or null to greet. */
export function pickHeroHourTarget(player: Player, opponents: Player[]): Player | null {
  const cfg = getCharacterConfig(player);
  if (!cfg) return null;

  const eligible = opponents.filter((o) => player.units >= cfg.fightThreshold.heroHour * o.units);
  if (eligible.length === 0) return null;

  return eligible.reduce((a, b) => (b.units < a.units ? b : a));
}

/** Caravan: attack iff the player's army is big enough relative to the caravan's guards. */
export function shouldAttackCaravan(player: Player, defendingUnits: number): boolean {
  const cfg = getCharacterConfig(player);
  if (!cfg) return false;
  return player.units >= cfg.fightThreshold.caravan * defendingUnits;
}

export type GuardsAction = 'pay' | 'sell-then-resolve' | 'fight' | 'accept-loss';

/**
 * Guards encounter for the two simple strategies. The 'wizard' strategy has
 * its own richer decision function — see ai/wizardGuards.ts.
 */
export function pickGuardsAction(player: Player, opts: FeeOptions): GuardsAction {
  const cfg = getCharacterConfig(player);
  if (!cfg || cfg.guards.strategy === 'wizard') return 'accept-loss';

  if (cfg.guards.strategy === 'prefer-fight') {
    if (opts.canFight) return 'fight';
    if (opts.canPay) return 'pay';
    if (opts.canSell) return 'sell-then-resolve';
    return 'accept-loss';
  }

  if (opts.canPay) return 'pay';
  if (opts.canSellForFee) return 'sell-then-resolve';
  if (opts.canFight) return 'fight';
  return 'accept-loss';
}

/** Dragon: same threshold for both the proactive challenge and a random ambush. */
export function shouldChallengeDragon(player: Player): boolean {
  const cfg = getCharacterConfig(player);
  if (!cfg) return false;
  return player.units >= cfg.dragonThreshold;
}

/** King's Castle: how many units to hire out of the actually-allowed maxAmount. */
export function pickKingsCastleHireAmount(player: Player, maxAmount: number): number {
  const cfg = getCharacterConfig(player);
  if (!cfg) return 0;

  if (cfg.id === 'wizard') {
    // Shrink the hire amount by 2/3 each round until its cost stays under
    // 2/3 of his gold (keeping a comfortable reserve), down to 1 unit.
    let amount = maxAmount;
    while (amount >= 1) {
      if (amount * UNIT_PRICE < (2 / 3) * player.gold) return amount;
      if (amount === 1) return 0;
      amount = Math.max(1, Math.floor(amount * (2 / 3)));
    }
    return 0;
  }

  return Math.floor(cfg.kingsCastleHireFraction * maxAmount);
}
