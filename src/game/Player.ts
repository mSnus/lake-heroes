import { CharacterId } from '../ai/characters';
import { computeArmyPower, computeSlotsUsed, remainingCapacity, slotCountForFame } from './army';

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
  /** Cheap, always-recruitable tier. */
  militia: number;
  /** Pricier tier unlocked at KNIGHT_FAME — see game/army.ts. */
  riders: number;
  ownedTiles: number[];
  position: number;
  image: string;
  turnsToSkip: number;
  fame: number;
  circles: number;
  dragonEncounters: number;
  dragonEncounteredLastTurn: boolean;
  caravanEncounters: number;
  caravanEncounteredLastTurn: boolean;
  ambushEncounters: number;
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
  isComputer: boolean;
  character?: CharacterId;
  artifacts: string[];

  constructor(params: PlayerParams) {
    this.id = params.id ?? 0;
    this.name = params.name;
    this.color = params.color;
    this.lightColor = params.lightColor ?? params.color;
    this.gold = params.gold;
    this.militia = params.units;
    this.riders = 0;
    this.position = params.position;
    this.image = params.image;
    this.ownedTiles = [];
    this.turnsToSkip = 0;
    this.fame = params.fame ?? 1;
    this.circles = 0;
    this.dragonEncounters = 0;
    this.dragonEncounteredLastTurn = false;
    this.caravanEncounters = 0;
    this.caravanEncounteredLastTurn = false;
    this.ambushEncounters = 0;
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

  /** Army slots available at this player's current fame. */
  get armySlots(): number {
    return slotCountForFame(this.fame);
  }

  get slotsUsed(): number {
    return computeSlotsUsed(this.militia, this.riders);
  }

  remainingCapacity(tier: 'militia' | 'riders'): number {
    return remainingCapacity(this.militia, this.riders, this.armySlots, tier);
  }

  /** Add militia, clamped to remaining slot capacity — the slot cap applies
   * uniformly to every source of militia growth, not just deliberate
   * recruiting, since that's what makes Riders worth their price. */
  gainMilitia(amount: number): number {
    if (amount <= 0) return 0;
    const added = Math.min(amount, this.remainingCapacity('militia'));
    this.militia += added;
    return added;
  }

  gainRiders(amount: number): number {
    if (amount <= 0) return 0;
    const added = Math.min(amount, this.remainingCapacity('riders'));
    this.riders += added;
    return added;
  }
}
