import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { CHARACTERS, CharacterConfig, CharacterId } from './characters';
import { FeeOptions } from '../actions/feeOptions';
import { getOverrides } from '../utils/overridesStore';
import { DRAGON_UNITS_THRESHOLD } from '../actions/fightDragon';
import { computeAnnualReward } from '../game/kingsGrace';
import { UnitTier, remainingCapacity, garrisonSlotCapacity } from '../game/army';
import { ForkChoice } from '../utils/forkChoiceStore';

export function getCharacterConfig(player: Player): CharacterConfig | null {
  return player.character ? CHARACTERS[player.character] : null;
}

// Chance a bot takes the fork's short/left path rather than the long/right
// one -- stands in for a human's manual "Go left"/"Go right" pick (see
// TurnAnnouncement.tsx), since a bot never sees those buttons.
const FORK_LEFT_CHANCE: Record<CharacterId, number> = {
  explorer: 0.8,
  warrior: 0.2,
  wizard: 0.6,
};

export function pickForkChoice(character: CharacterId | undefined): ForkChoice {
  const chance = FORK_LEFT_CHANCE[character ?? 'explorer'];
  return Math.random() < chance ? 'short' : 'long';
}

function wouldFormSyndicate(board: GameState, tile: Tile): boolean {
  const groupTiles = board.tiles.filter((t) => t?.isOwnable && t.group === tile.group);
  const unowned = groupTiles.filter((t) => !t.isOwned());
  return unowned.length === 1 && unowned[0] === tile;
}

// "current income" = units gained per lap of the board (the King's grace
// reward), since that's the only recurring unit income most players have.
function closeToDragonGoalWithoutBuying(board: GameState, player: Player): boolean {
  const perLapUnits = computeAnnualReward(board, player).totalUnits;
  return player.armyPower + perLapUnits * 3 >= DRAGON_UNITS_THRESHOLD;
}

/** Should this bot claim the unowned tile it's standing on? */
export function shouldClaimTile(player: Player, tile: Tile, board: GameState): boolean {
  const cfg = getCharacterConfig(player);
  if (!cfg) return false;

  // Warrior/Wizard: if the dragon-challenge goal is only ~3 laps away on
  // current income alone, skip buying tiles that don't complete a syndicate
  // — no point diluting gold/units into real estate this close to the goal.
  if (
    cfg.skipBuyingNearDragonGoal &&
    !wouldFormSyndicate(board, tile) &&
    closeToDragonGoalWithoutBuying(board, player)
  ) {
    return false;
  }

  if (!tile.isAffordable(player.gold, player.armyPower, player.fame, board.round)) return false;

  if (cfg.claim.type === 'chance') {
    return Math.random() < cfg.claim.chance;
  }

  if (cfg.claim.type === 'afford-no-banzai') {
    // Plain affordability, but reject the banzai exception isAffordable()
    // would otherwise allow (i.e. require the real, non-banzai defence).
    return player.armyPower >= tile.getDefence(1);
  }

  // threshold type (explorer): never banzai — require the plain (non-banzai)
  // defence to be met, then apply the tighter army/gold fractions on top.
  const lvl1Defence = tile.getDefence(1);
  if (player.armyPower < lvl1Defence) return false;
  const armyOk = lvl1Defence <= cfg.claim.armyFraction * player.armyPower;
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
      (bonusGain === bestBonusGain &&
        best !== null &&
        price.gold < best.prices[best.level + 1].gold);

    if (better || best === null) {
      best = tile;
      bestBonusGain = bonusGain;
    }
  }

  return best;
}

/**
 * Hero's Hour: check opponents weakest-first (fewest units first) and fight
 * the first one that clears the character's army-ratio threshold, or null
 * to greet if none do.
 */
export function pickHeroHourTarget(player: Player, opponents: Player[]): Player | null {
  const cfg = getCharacterConfig(player);
  if (!cfg) return null;

  const byWeakest = [...opponents].sort((a, b) => a.armyPower - b.armyPower);
  return (
    byWeakest.find((o) => player.armyPower >= cfg.fightThreshold.heroHour * o.armyPower) ?? null
  );
}

/** Caravan: attack iff the player's army is big enough relative to the caravan's guards. */
export function shouldAttackCaravan(player: Player, defendingUnits: number): boolean {
  const cfg = getCharacterConfig(player);
  if (!cfg) return false;
  return player.armyPower >= cfg.fightThreshold.caravan * defendingUnits;
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
  return player.armyPower >= cfg.dragonThreshold;
}

/**
 * Top up the weakest-defended owned tile (lowest garrison first) with
 * traveling units, up to the character's garrisonFraction of the bot's
 * current army — so bot-owned tiles aren't free razes for a human/bot rival.
 */
export function pickGarrisonAction(
  board: GameState,
  player: Player
): { tile: Tile; amount: number } | null {
  const cfg = getCharacterConfig(player);
  if (!cfg) return null;

  const candidates = player.ownedTiles
    .map((idx) => board.tiles[idx])
    .filter((t): t is Tile => !!t && t.owner === player.id && t.garrisonMilitia < t.baseGarrison);
  if (candidates.length === 0) return null;

  const target = candidates.sort((a, b) => a.garrisonMilitia - b.garrisonMilitia)[0];
  const desired = target.baseGarrison - target.garrisonMilitia;
  const affordable = Math.floor(cfg.garrisonFraction * player.militia);
  const cap = remainingCapacity(
    target.garrisonMilitia,
    target.garrisonRiders,
    target.garrisonSlots,
    'militia',
    garrisonSlotCapacity()
  );
  const amount = Math.min(desired, affordable, cap);

  return amount > 0 ? { tile: target, amount } : null;
}

/** King's Castle: which tier a bot should recruit this visit. Riders are
 * pricier but stronger per body — warrior/wizard lean into them once
 * unlocked, explorer stays cheap and mobile on militia. */
export function pickKingsCastleHireTier(player: Player): UnitTier {
  const cfg = getCharacterConfig(player);
  if (!cfg || !player.isKnight || cfg.id === 'explorer') return 'militia';
  return 'riders';
}

/** King's Castle: how many units to hire out of the actually-allowed maxAmount. */
export function pickKingsCastleHireAmount(
  player: Player,
  maxAmount: number,
  unitPrice: number = getOverrides().militiaPrice
): number {
  const cfg = getCharacterConfig(player);
  if (!cfg) return 0;

  if (cfg.id === 'wizard') {
    // Shrink the hire amount by 2/3 each round until its cost stays under
    // 2/3 of his gold (keeping a comfortable reserve), down to 1 unit.
    let amount = maxAmount;
    while (amount >= 1) {
      if (amount * unitPrice < (2 / 3) * player.gold) return amount;
      if (amount === 1) return 0;
      amount = Math.max(1, Math.floor(amount * (2 / 3)));
    }
    return 0;
  }

  return Math.floor(cfg.kingsCastleHireFraction * maxAmount);
}
