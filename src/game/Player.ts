import { CharacterId } from '../ai/characters';
import { UnitTier, armyCapacityForFame, computeArmyPower } from './army';

export interface YearIncome {
  gold: number;
  food: number;
  arms: number;
  units: number;
}

export const emptyYearIncome = (): YearIncome => ({ gold: 0, food: 0, arms: 0, units: 0 });

export interface PlayerParams {
  id?: number;
  name: string;
  color: string;
  lightColor?: string;
  gold: number;
  units: number;
  position: number;
  image: string;
  fame?: number;
  isComputer?: boolean;
  character?: CharacterId;
}

export class Player {
  id: number;
  name: string;
  color: string;
  lightColor: string;
  gold: number;
  /** Raw materials a unit is made from (see game/resources.ts). */
  food: number;
  arms: number;
  /** Everything this player's tiles and the King paid out this calendar
   * year so far; moved to lastYearIncome when the year ends. */
  yearIncome: YearIncome;
  lastYearIncome: YearIncome;
  /** Cheap, always-recruitable tier. */
  militia: number;
  /** Pricier tier unlocked at KNIGHT_FAME — see game/army.ts. */
  riders: number;
  ownedTiles: number[];
  position: number;
  image: string;
  turnsToSkip: number;
  fame: number;
  /** Clandestine moral-standing counter -- see utils/karma.ts. Signed, 0 at
   * start, never shown directly (only a 🕷️ marker once it goes negative). */
  karma: number;
  /** One per prisoner of war this player has taken (see utils/stars.ts,
   * credited to the tile owner whose toll bankrupted the prisoner) --
   * reaching STARS_TO_WIN ends the game, same as slaying the Dragon. */
  stars: number;
  circles: number;
  dragonEncounters: number;
  dragonEncounteredLastTurn: boolean;
  caravanEncounters: number;
  caravanEncounteredLastTurn: boolean;
  ambushEncounters: number;
  rogueAttackEncounters: number;
  workersEncounters: number;
  /** The year this player's units first dropped to (and have stayed at) 0,
   * or undefined while they hold any -- see actions/workersEncounter.tsx,
   * which sets/clears it on every check and doubles its own odds once a
   * full year has passed since. Not reset at year rollover; only clearing
   * to undefined (units > 0) or being overwritten (a fresh drop to 0) ever
   * changes it. */
  zeroUnitsSinceYear?: number;
  /** Set when Divine Beads wins its 50% roll against a live Plague --
   * the roll happens once, at the moment Plague fires (actions/joker.ts),
   * not every turn, so this stamps which year that exemption is good for
   * rather than re-rolling (which would make the protection flicker on
   * and off turn to turn). income.ts's tileTurnIncome checks it alongside
   * Pipe of Hamelin, which needs no stamp since it protects live, every
   * turn, for as long as it's held -- see that function's own comment. */
  plagueImmuneUntilYear?: number;
  isPrisonerOfWar: boolean;
  hasClaimedThisTurn: boolean;
  hasConsideredClaimThisTurn: boolean;
  /** Set once the current opponent-tile encounter (pay fee / fight / accept
   * loss) has been resolved for this turn -- lets afterMoveLogic.ts skip
   * re-showing the same encounter screen if the page is reloaded before the
   * player gets around to clicking End Turn (turnPhase stays 'after-move'
   * either way, so a reload would otherwise re-derive and re-show it from
   * scratch since paying a fee, for instance, doesn't change tile
   * ownership). */
  hasResolvedTileEncounterThisTurn: boolean;
  /** Set the first time the King's Castle screen is opened this turn (even
   * if the contract roll fails) -- guards issueKingsContract against being
   * re-rolled by re-clicking the King's Castle tile repeatedly before
   * actually ending the turn. */
  hasCheckedKingsContractThisTurn: boolean;
  hasBeenOfferedDragonChallenge: boolean;
  /** Set once the King's Promotion screen has fired — only then can Riders
   * actually be recruited, even if fame already meets KNIGHT_FAME. */
  isKnight: boolean;
  upgradesThisTurn: number;
  /** How much militia this player's bot has already committed to garrisons
   * THIS turn -- lets pickGarrisonAction reconstruct a stable per-turn
   * budget (garrisonFraction × militia as it stood at the turn's start)
   * instead of re-deriving the fraction from the live, ever-shrinking
   * militia count on every call, which used to make the AI dribble
   * reinforcements onto a tile 1 unit at a time. See ai/decisions.ts. */
  garrisonSpentThisTurn: number;
  /** Remaining amount still owed toward the current tile's toll (see
   * afterMoveLogic.ts's chargeToll) -- nonzero only while short of funds
   * and partway through selling tiles to cover the rest. */
  owedToll: number;
  /** Set once this turn's toll has been fully settled, whether paid
   * outright or via selling -- lets a later re-entry into the same
   * encounter (e.g. after a lost revenge attack, which re-shows the
   * screen) go straight back to the peace/revenge choice instead of
   * charging the toll a second time. */
  hasSettledTollThisTurn: boolean;
  /** Set once this player has pillaged any tile this turn -- a raid attempt
   * on an unowned tile, see actions/pillageTile.ts. Only one per turn,
   * regardless of which tile. */
  hasPillagedThisTurn: boolean;
  isComputer: boolean;
  character?: CharacterId;
  artifacts: string[];

  constructor(params: PlayerParams) {
    this.id = params.id ?? 0;
    this.name = params.name;
    this.color = params.color;
    this.lightColor = params.lightColor ?? params.color;
    this.gold = params.gold;
    this.food = 0;
    this.arms = 0;
    this.yearIncome = emptyYearIncome();
    this.lastYearIncome = emptyYearIncome();
    this.militia = params.units;
    this.riders = 0;
    this.position = params.position;
    this.image = params.image;
    this.ownedTiles = [];
    this.turnsToSkip = 0;
    this.fame = params.fame ?? 1;
    this.karma = 0;
    this.stars = 0;
    this.circles = 0;
    this.dragonEncounters = 0;
    this.dragonEncounteredLastTurn = false;
    this.caravanEncounters = 0;
    this.caravanEncounteredLastTurn = false;
    this.ambushEncounters = 0;
    this.rogueAttackEncounters = 0;
    this.workersEncounters = 0;
    this.isPrisonerOfWar = false;
    this.hasClaimedThisTurn = false;
    this.hasConsideredClaimThisTurn = false;
    this.hasResolvedTileEncounterThisTurn = false;
    this.hasCheckedKingsContractThisTurn = false;
    this.hasBeenOfferedDragonChallenge = false;
    this.isKnight = false;
    this.upgradesThisTurn = 0;
    this.garrisonSpentThisTurn = 0;
    this.owedToll = 0;
    this.hasSettledTollThisTurn = false;
    this.hasPillagedThisTurn = false;
    this.isComputer = params.isComputer ?? false;
    this.character = params.character;
    this.artifacts = [];
  }

  /**
   * Raw headcount (militia+riders) — kept as the compatibility surface for
   * every existing `player.units +=/-= N` call site (rewards, fees, upgrade
   * costs, casualties). Gains land on militia (the cheap, always-available
   * tier — deliberate Rider recruiting goes through gainRiders() instead).
   * Losses drain militia first, riders only once militia is exhausted —
   * this IS the tier system's loss-ordering rule, applied for free to every
   * existing casualty call site.
   */
  get units(): number {
    return this.militia + this.riders;
  }

  set units(value: number) {
    const delta = value - this.units;
    if (delta >= 0) {
      this.gainMilitia(delta);
    } else {
      let loss = -delta;
      const militiaLoss = Math.min(this.militia, loss);
      this.militia -= militiaLoss;
      loss -= militiaLoss;
      this.riders = Math.max(0, this.riders - loss);
    }
  }

  /** Weighted combat value — what battle-eligibility thresholds compare
   * against instead of raw headcount. */
  get armyPower(): number {
    return computeArmyPower(this.militia, this.riders);
  }

  /** Militia/rider headcount caps at this player's fame -- riders need knighthood. */
  get armyCapacity(): { militia: number; riders: number } {
    const cap = armyCapacityForFame(this.fame);
    return this.isKnight ? cap : { militia: cap.militia, riders: 0 };
  }

  /** How many more of `tier` fit under its cap. */
  armyRoom(tier: UnitTier): number {
    const held = tier === 'militia' ? this.militia : this.riders;
    return Math.max(0, this.armyCapacity[tier] - held);
  }

  /** Add militia, clamped to the militia cap -- applies to every source of
   * militia growth, not just deliberate recruiting. */
  gainMilitia(amount: number): number {
    if (amount <= 0) return 0;
    const added = Math.min(amount, this.armyRoom('militia'));
    this.militia += added;
    return added;
  }

  gainRiders(amount: number): number {
    if (amount <= 0) return 0;
    const added = Math.min(amount, this.armyRoom('riders'));
    this.riders += added;
    return added;
  }
}
