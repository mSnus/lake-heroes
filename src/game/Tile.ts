import { FEE_MULTIPLIER, BRAWL_THRESHOLD } from './constants';
import groups from '../settings/groups.json';
import { computeArmyPower, remainingCapacity } from './army';
import { t, tOptional } from '../i18n';

export interface TileJSON {
  /** Stable, never-translated slug (e.g. "king-castle") — every game-logic
   * check against "which tile is this" uses this, never the (translatable)
   * display name. */
  id: string;
  group: string;
  /** Not present in tiles.json (translated, computed from `id` — see the
   * Tile class getter); optional here only so the raw JSON template shape
   * type-checks. */
  name?: string;
  isOwnable: boolean;
  bonusType?: 'gold' | 'units';
  prices?: { [level: number]: { gold: number; units: number } };
  bonuses?: { [level: number]: number };
  defences?: { [level: number]: number };
  owner?: number | null;
  level?: number;
  description?: string;
  sprite?: { x: number; y: number };
  spriteImage?: string;
  requiredFame?: number;
  fog?: boolean;
  /** Current units stationed here (owner-assigned once owned, wild-guard
   * count while unowned). Owned tiles: derived from garrisonMilitia/Riders
   * below. Unowned: the wild-guard headcount (no tier). */
  garrison?: number;
  /** Owned-tile garrison composition (see game/army.ts for tiers). Absent
   * on a legacy/pre-tier save — migrated from `garrison` on load. */
  garrisonMilitia?: number;
  garrisonRiders?: number;
  /** Immutable authored baseline the wild garrison regrows toward. Falls
   * back to `garrison` on first load (fresh/never-claimed tile). */
  baseGarrison?: number;
  /** Turn (GameState.turns) since this tile went unowned, or undefined if it
   * was never razed — drives the wild-garrison regrowth timer. */
  unclaimedSinceTurn?: number;
  /** GameState.round the tile was last razed in — gates re-claiming until
   * the round advances ("on fire"). */
  razedInRound?: number;
}

export class Tile implements TileJSON {
  id: string;
  group: string;
  isOwnable: boolean;
  bonusType: 'gold' | 'units';
  prices: { [level: number]: { gold: number; units: number } };
  bonuses: { [level: number]: number };
  defences: { [level: number]: number };
  owner?: number | null;
  _level?: number;
  sprite?: { x: number; y: number };
  spriteImage?: string;
  requiredFame: number;
  fog: boolean;
  /** Wild-guard headcount while unowned (no tier — see the `garrison`
   * accessor below for the owned-tile path). */
  private _garrison: number;
  /** Owned-tile garrison composition. */
  garrisonMilitia: number;
  garrisonRiders: number;
  /** Immutable authored baseline this tile's wild garrison regrows toward. */
  baseGarrison: number;
  unclaimedSinceTurn?: number;
  razedInRound?: number;

  constructor(data: Partial<TileJSON> = {}) {
    this.id = data.id || '';
    this.group = data.group || '';
    this.isOwnable = !!data.isOwnable;
    this.bonusType = data.bonusType || 'gold';
    this.prices = Object.assign({}, data.prices || {});
    this.bonuses = Object.assign({}, data.bonuses || {});
    this.defences = Object.assign({}, data.defences || {});
    this.owner = data.owner ?? null;
    this._level = typeof data.level === 'number' ? data.level : 1;
    this.sprite = data.sprite;
    this.spriteImage = data.spriteImage;
    this.requiredFame = data.requiredFame ?? 0;
    this.fog = data.fog !== false && this.isOwnable;
    this._garrison = data.garrison ?? 0;
    this.baseGarrison = data.baseGarrison ?? data.garrison ?? 0;
    if (this.owner && data.garrisonMilitia === undefined && data.garrisonRiders === undefined) {
      // Legacy (pre-tier) save: migrate the flat garrison to militia.
      this.garrisonMilitia = data.garrison ?? 0;
      this.garrisonRiders = 0;
    } else {
      this.garrisonMilitia = data.garrisonMilitia ?? 0;
      this.garrisonRiders = data.garrisonRiders ?? 0;
    }
    this.unclaimedSinceTurn = data.unclaimedSinceTurn;
    this.razedInRound = data.razedInRound;
  }

  /** Translated display name, looked up live by `id` — never store this,
   * so it always reflects whatever language is currently active. */
  get name(): string {
    return t(`tiles.${this.id}.name`);
  }

  /** Only some tiles (the non-ownable "special" ones) have flavor text —
   * undefined (not a fallback string) when this tile genuinely has none. */
  get description(): string | undefined {
    return tOptional(`tiles.${this.id}.description`);
  }

  /** Garrison slots this tile can hold — scales with level, same as a
   * player's army slots scale with fame (see game/army.ts). */
  get garrisonSlots(): number {
    return this.level;
  }

  get garrisonPower(): number {
    return computeArmyPower(this.garrisonMilitia, this.garrisonRiders);
  }

  /** Compatibility surface for every existing `tile.garrison +=/-=/= N` call
   * site — mirrors Player.units: owned tiles read/write the tiered
   * militia/riders pair (gains -> militia, losses drain militia first),
   * unowned tiles read/write the untiered wild-guard headcount directly. */
  get garrison(): number {
    return this.owner ? this.garrisonMilitia + this.garrisonRiders : this._garrison;
  }

  set garrison(value: number) {
    if (!this.owner) {
      this._garrison = Math.max(0, Math.floor(value));
      return;
    }
    const delta = value - this.garrison;
    if (delta >= 0) {
      const cap = remainingCapacity(this.garrisonMilitia, this.garrisonRiders, this.garrisonSlots, 'militia');
      this.garrisonMilitia += Math.min(delta, cap);
    } else {
      let loss = -delta;
      const militiaLoss = Math.min(this.garrisonMilitia, loss);
      this.garrisonMilitia -= militiaLoss;
      loss -= militiaLoss;
      this.garrisonRiders = Math.max(0, this.garrisonRiders - loss);
    }
  }

  get groupColor(): string {
    const meta = (groups as { name: string; icon: string; color: string }[]).find(
      (g) => g.name === this.group
    );
    return meta?.color ?? '#eee';
  }

  get groupTextColor(): string {
    const meta = (groups as { name: string; icon: string; color: string; textColor: string }[]).find(
      (g) => g.name === this.group
    );
    return meta?.textColor ?? '#444';
  }

  get level(): number {
    return this._level ?? 1;
  }

  get defence(): number {
    const level = this._level ?? 1;
    return this.getDefence(level);
  }

  get fee(): number {
    // Experiment: fee = sum of prices.gold up to the current level.
    let gold = 0;
    for (let lvl = 1; lvl <= this.level; lvl++) {
      gold += this.prices[lvl]?.gold || 0;
    }

    return gold;
  }

  isOwned(): boolean {
    return !!this.owner;
  }

  fogged(): boolean {
    return this.fog;
  }

  /** True while a razed tile is still "on fire" — unbuyable for the rest of
   * the round it was razed in (GameState.round hasn't advanced past it). */
  isOnFire(currentRound: number): boolean {
    return this.razedInRound !== undefined && currentRound <= this.razedInRound;
  }

  isAffordable(
    playerGold: number,
    playerUnits: number,
    playerFame: number,
    currentRound: number = Infinity
  ): boolean {
    if (this.isOnFire(currentRound)) return false;

    const lvl1Defence = this.getDefence(1);
    // Brawl tiles (low defence) always require enough units to win the
    // winner-take-all round. Above the brawl threshold, an attacker with
    // more than that many units may "banzai" — attack a tougher tile than
    // their army could normally win — as a deliberate gamble.
    const isBrawlTile = lvl1Defence <= BRAWL_THRESHOLD;
    const canBanzai = !isBrawlTile && playerUnits > BRAWL_THRESHOLD;
    return (
      playerGold >= this.prices['1'].gold &&
      (canBanzai || playerUnits >= lvl1Defence) &&
      playerFame >= this.requiredFame
    );
  }

  isUpgradeable(playerGold: number, playerUnits: number): boolean {
    return !!this.prices && this.level !== undefined && this.prices[this.level + 1] !== undefined
      ? playerGold >= this.prices[this.level + 1].gold &&
          playerUnits >= this.prices[this.level + 1].units
      : false;
  }

  // level should be 1|2|3 (but kept generic)
  getPrice(level: number = 1): { gold: number; units: number } {
    const key = level;
    if (level === 1)
      return { gold: this.prices['1'].gold || 0, units: this.prices['1'].units || 0 };
    const up = this.prices && this.prices[key];
    return { gold: up?.gold || 0, units: up?.units || 0 };
  }

  get currentPrice(): { gold: number; units: number } {
    let priceGold = 0;
    let priceUnits = 0;

    for (let lvl = 1; lvl <= this.level; lvl++) {
      priceGold += this.prices[lvl].gold || 0;
      // Base level's units cost mirrors the base-level defence (matches
      // isAffordable()'s units check); upgrade levels still use their price.
      priceUnits += lvl === 1 ? this.getDefence(1) : this.prices[lvl].units || 0;
    }

    return { gold: priceGold, units: priceUnits };
  }

  getBonus(level: number = 1): number {
    return this.bonuses ? this.bonuses[level] || 0 : 0;
  }

  /** % bonus a garrison gets from being stationed on a tile of this level. */
  getGarrisonBonusPct(level: number): number {
    return level >= 3 ? 0.5 : level === 2 ? 0.25 : 0.1;
  }

  getDefence(level: number = 1): number {
    // Defence = the garrison's weighted power (Riders count for more than
    // Militia — see game/army.ts), boosted by the tile's level. Wild/unowned
    // guards have no tier, so their power is just their headcount.
    const power = this.owner ? this.garrisonPower : this._garrison;
    return Math.ceil(power * (1 + this.getGarrisonBonusPct(level)));
  }

  toJSON(): TileJSON {
    return {
      id: this.id,
      group: this.group,
      name: this.name,
      isOwnable: this.isOwnable,
      bonusType: this.bonusType,
      prices: this.prices,
      bonuses: this.bonuses,
      defences: this.defences,
      owner: this.owner,
      level: this.level,
      description: this.description,
      sprite: this.sprite,
      spriteImage: this.spriteImage,
      requiredFame: this.requiredFame,
      fog: this.fog,
      garrison: this._garrison,
      garrisonMilitia: this.garrisonMilitia,
      garrisonRiders: this.garrisonRiders,
      baseGarrison: this.baseGarrison,
      unclaimedSinceTurn: this.unclaimedSinceTurn,
      razedInRound: this.razedInRound,
    };
  }
}
