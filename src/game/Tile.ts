import { BONUS_GOLD_RATIO, TURN_INCOME_RATIO, LEVEL_3_UPGRADE_MULT, ANNUAL_DEFAULT_GOLD_MULT, TOWER_GARRISON_BONUS_SLOTS } from './constants';
import { getOverrides } from '../utils/overridesStore';
import groups from '../settings/groups.json';
import { computeArmyPower, remainingCapacity, garrisonSlotCapacity, UNIT_POWER, isBanzaiAttack } from './army';
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
  /** Purchase (level 1) and upgrade (2, 3) cost, as a coefficient of the
   * TILE_BASE_* values -- see the `prices` getter. */
  prices?: { [level: number]: number };
  bonuses?: { [level: number]: number };
  /** King's Castle pass reward, units-type tiles only (Camps/Towers) --
   * multiple of TILE_BASE_PRICE, so it rescales with a live tile-price
   * override the same way prices/bonuses do. Falls back to
   * ANNUAL_DEFAULT_GOLD's own multiple when a units-type tile doesn't set
   * this (there's currently no such tile, but new ones may not bother). */
  annualGoldMult?: number;
  /** King's Castle pass reward's OTHER resource, units-type tiles only --
   * flat per level, not a TILE_BASE_PRICE multiple (unlike annualGoldMult),
   * since these are small hand-tuned numbers rather than a price-derived
   * curve. Absent (or 0) means no per-level bonus, the default for every
   * tile except the ones that opt in. */
  annualUnits?: { [level: number]: number };
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
  /** True from the moment a tile is razed until someone successfully claims
   * it — unlike `razedInRound` (which only gates the current round), this
   * persists across rounds and drives the tile's Zombie-guarded wild garrison
   * (see game/battleGrid/engine.ts's zombie kind). */
  abandoned?: boolean;
  /** Owner has yielded the tile to the King: still owned, but produces no
   * yearly/visit bonus, can't be attacked by a Rogue Attack, and its
   * garrison can't be adjusted, until taken back. */
  isYielded?: boolean;
}

export class Tile implements TileJSON {
  id: string;
  group: string;
  isOwnable: boolean;
  bonusType: 'gold' | 'units';
  /** Authored price/income coefficients (from tiles.json). The real gold
   * numbers are computed on read by the `prices` / `bonuses` getters using the
   * live TILE_BASE_* overrides, so an economy tweak (⚖️ screen) reprices every
   * tile immediately. */
  private _priceCoeffs: { [level: number]: number };
  private _bonusCoeffs: { [level: number]: number };
  private _annualGoldMult?: number;
  /** Extra King's-grace units on top of annualGold, units-type tiles only --
   * see the TileJSON field for why this isn't a TILE_BASE_PRICE multiple. */
  annualUnits: { [level: number]: number };
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
  abandoned: boolean;
  isYielded: boolean;

  constructor(data: Partial<TileJSON> = {}) {
    this.id = data.id || '';
    this.group = data.group || '';
    this.isOwnable = !!data.isOwnable;
    this.bonusType = data.bonusType || 'gold';
    // Prices and income are authored in tiles.json as coefficients of the
    // TILE_BASE_* values. Store the raw coefficients (deep-copied so we never
    // mutate the shared template objects) and materialise real gold lazily in
    // the `prices` / `bonuses` getters, so a live TILE_BASE_* override reprices
    // every tile without rebuilding it.
    this._priceCoeffs = {};
    for (const key of Object.keys(data.prices || {})) {
      const lvl = Number(key);
      this._priceCoeffs[lvl] = data.prices![lvl] || 0;
    }

    this._bonusCoeffs = {};
    for (const key of Object.keys(data.bonuses || {})) {
      const lvl = Number(key);
      this._bonusCoeffs[lvl] = data.bonuses![lvl] || 0;
    }

    this._annualGoldMult = data.annualGoldMult;
    this.annualUnits = Object.assign({}, data.annualUnits || {});
    this.owner = data.owner ?? null;
    this._level = typeof data.level === 'number' ? data.level : 1;
    this.sprite = data.sprite;
    this.spriteImage = data.spriteImage;
    this.requiredFame = data.requiredFame ?? 0;

    //DEBUG: disabled fog
    this.fog = false;//data.fog !== false && this.isOwnable;
    
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
    this.abandoned = data.abandoned ?? false;
    this.isYielded = data.isYielded ?? false;
  }

  /** Translated display name, looked up live by `id` — never store this,
   * so it always reflects whatever language is currently active. */
  get name(): string {
    return t(`tiles.${this.id}.name`);
  }

  /** Compact plural label (e.g. "Pigs farm" -> "Pigs", "Cannon tower" ->
   * "Cannons") -- the significant part of the full name, for places too
   * small for it (e.g. the owned-tiles summary dots). Falls back to the
   * full name for tiles that don't have one (the non-ownable "special"
   * tiles, whose names are already short). */
  get shortName(): string {
    return tOptional(`tiles.${this.id}.shortName`) ?? this.name;
  }

  /** Purchase/upgrade prices in real gold, computed from the authored
   * coefficients and the live TILE_BASE_PRICE / upgrade-multiplier overrides.
   * Level 1 is the purchase price; 2 and 3 are upgrade costs, both at the
   * upgrade rate (LEVEL_3_UPGRADE_MULT is 1, so level 3 costs no premium). */
  get prices(): { [level: number]: number } {
    const ov = getOverrides();
    const upgradeBase = ov.tileBasePrice * ov.tileUpgradeMult;
    const out: { [level: number]: number } = {};
    for (const key of Object.keys(this._priceCoeffs)) {
      const lvl = Number(key);
      const goldBase = lvl <= 1 ? ov.tileBasePrice : lvl >= 3 ? upgradeBase * LEVEL_3_UPGRADE_MULT : upgradeBase;
      out[lvl] = this._priceCoeffs[lvl] * goldBase;
    }

    return out;
  }

  /** Per-level income, paid out every turn (see game/income.ts's
   * collectTileTurnIncome), computed from coefficients and the live income
   * multiplier. Gold-type tiles pay gold (× base × mult, then cut by
   * BONUS_GOLD_RATIO and TURN_INCOME_RATIO, rounded to the nearest 50) --
   * that's the only thing the income multiplier scales; unit-type tiles
   * (Camps/Towers) pay a raw unit headcount, unscaled by it. */
  get bonuses(): { [level: number]: number } {
    const ov = getOverrides();
    const isGold = this.bonusType === 'gold';
    const incomeBase = isGold ? ov.tileBasePrice * ov.tileIncomeMult : 1;
    const out: { [level: number]: number } = {};
    for (const key of Object.keys(this._bonusCoeffs)) {
      const lvl = Number(key);
      const raw = this._bonusCoeffs[lvl] * incomeBase;
      out[lvl] = isGold ? Math.round((raw * BONUS_GOLD_RATIO * TURN_INCOME_RATIO) / 50) * 50 : raw;
    }

    return out;
  }

  /** King's-grace gold for a units-type tile (Camps/Towers) -- see
   * kingsGrace.ts's computeAnnualReward, the only consumer. Rescales with a
   * live tileBasePrice override, same as prices/bonuses. */
  get annualGold(): number {
    return (this._annualGoldMult ?? ANNUAL_DEFAULT_GOLD_MULT) * getOverrides().tileBasePrice;
  }

  /** Only some tiles (the non-ownable "special" ones) have flavor text —
   * undefined (not a fallback string) when this tile genuinely has none. */
  get description(): string | undefined {
    return tOptional(`tiles.${this.id}.description`);
  }

  /** Garrison slots this tile can hold — scales with level, same as a
   * player's army slots scale with fame (see game/army.ts). Towers are
   * fortifications first, so they carry TOWER_GARRISON_BONUS_SLOTS extra
   * at every level: 16/24/32 rather than the usual 8/16/24. */
  get garrisonSlots(): number {
    return this.level + (this.group === 'Towers' ? TOWER_GARRISON_BONUS_SLOTS : 0);
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
      const cap = remainingCapacity(
        this.garrisonMilitia,
        this.garrisonRiders,
        this.garrisonSlots,
        'militia',
        garrisonSlotCapacity()
      );
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

  /** Toll a visitor owes: the current level's own price or the tile's base
   * price, whichever is larger -- not the two summed. */
  get fee(): number {
    return Math.max(this.prices[this.level] || 0, this.prices[1] || 0);
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

    // Rated strength, not headcount -- an abandoned tile's zombies are worth
    // more than their number, and the attacker's own power is weighted the
    // same way, so the two sides are compared on one scale.
    const lvl1Defence = this.getDefence(1) * (this.abandoned ? UNIT_POWER.zombies : 1);
    return (
      playerGold >= this.prices[1] &&
      (playerUnits >= lvl1Defence || isBanzaiAttack(lvl1Defence, playerUnits)) &&
      playerFame >= this.requiredFame
    );
  }

  get currentPrice(): { gold: number; units: number } {
    let priceGold = 0;
    let priceUnits = 0;

    for (let lvl = 1; lvl <= this.level; lvl++) {
      priceGold += this.prices[lvl] || 0;
    }

    // The units half of the price is the base level's defence (matching
    // isAffordable's own units check) -- upgrades cost gold only.
    priceUnits = this.getDefence(1);

    return { gold: priceGold, units: priceUnits };
  }

  getBonus(level: number = 1): number {
    return this.bonuses ? this.bonuses[level] || 0 : 0;
  }

  /** % bonus a garrison's rolls get from being stationed on a tile of this
   * level, applied additively to the roll itself during an actual battle
   * (see BattleScreen) — it no longer inflates the static defence/power
   * number below, so a fortified tile fights tougher without pretending to
   * have more defenders than it really does. */
  getGarrisonBonusPct(level: number): number {
    return level >= 3 ? 0.1 : level === 2 ? 0.08 : 0.06;
  }

  /**
   * The tile's defence as a strength rating rather than a headcount — an
   * abandoned tile's wild garrison guards as zombies, which are worth more
   * than their number (see UNIT_POWER). This is what decisions and displays
   * compare an army against; getDefence() stays a headcount because that's
   * what sizes the actual battle grid, where the zombies get their real
   * hp/damage and would otherwise be counted twice.
   */
  get defencePower(): number {
    return this.getDefence(this.level) * (this.abandoned ? UNIT_POWER.zombies : 1);
  }

  getDefence(_level: number = 1): number {
    // Defence = the garrison's weighted power (Riders count for more than
    // Militia — see game/army.ts). Wild/unowned guards have no tier, so
    // their power is just their headcount. The level's fortification bonus
    // is a roll-time bonus now (getGarrisonBonusPct), not baked in here, so
    // this no longer varies by level.
    return this.owner ? this.garrisonPower : this._garrison;
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
      annualGoldMult: this.annualGold,
      annualUnits: this.annualUnits,
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
      abandoned: this.abandoned,
      isYielded: this.isYielded,
    };
  }
}
