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
  hasBeenOfferedDragonChallenge: boolean;
  /** Set once the King's Promotion screen has fired — only then can Riders
   * actually be recruited, even if fame already meets KNIGHT_FAME. */
  isKnight: boolean;
  upgradesThisTurn: number;
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
    this.hasBeenOfferedDragonChallenge = false;
    this.isKnight = false;
    this.upgradesThisTurn = 0;
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
