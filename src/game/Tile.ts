import { FEE_MULTIPLIER, BRAWL_THRESHOLD } from './constants';
import { getOverrides } from '../utils/overridesStore';
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
  private _priceCoeffs: { [level: number]: { gold: number; units: number } };
  private _bonusCoeffs: { [level: number]: number };
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
      const p = data.prices![lvl];
      this._priceCoeffs[lvl] = { gold: p?.gold || 0, units: p?.units || 0 };
    }
    this._bonusCoeffs = {};
    for (const key of Object.keys(data.bonuses || {})) {
      const lvl = Number(key);
      this._bonusCoeffs[lvl] = data.bonuses![lvl] || 0;
    }
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
    this.abandoned = data.abandoned ?? false;
    this.isYielded = data.isYielded ?? false;
  }

  /** Translated display name, looked up live by `id` — never store this,
   * so it always reflects whatever language is currently active. */
  get name(): string {
    return t(`tiles.${this.id}.name`);
  }

  /** Purchase/upgrade prices in real gold, computed from the authored
   * coefficients and the live TILE_BASE_PRICE / upgrade-multiplier overrides.
   * Level-1 gold is the purchase price; higher levels are upgrade costs;
   * `units` are raw headcounts, never scaled. */
  get prices(): { [level: number]: { gold: number; units: number } } {
    const ov = getOverrides();
    const upgradeBase = ov.tileBasePrice * ov.tileUpgradeMult;
    const out: { [level: number]: { gold: number; units: number } } = {};
    for (const key of Object.keys(this._priceCoeffs)) {
      const lvl = Number(key);
      const p = this._priceCoeffs[lvl];
      const goldBase = lvl <= 1 ? ov.tileBasePrice : upgradeBase;
      out[lvl] = { gold: p.gold * goldBase, units: p.units };
    }
    return out;
  }

  /** Per-level income, computed from coefficients and the live income
   * multiplier. Gold-type tiles pay gold (× base × mult); unit-type tiles
   * (Camps/Towers) pay a raw unit headcount, unscaled. */
  get bonuses(): { [level: number]: number } {
    const ov = getOverrides();
    const incomeBase = this.bonusType === 'gold' ? ov.tileBasePrice * ov.tileIncomeMult : 1;
    const out: { [level: number]: number } = {};
    for (const key of Object.keys(this._bonusCoeffs)) {
      const lvl = Number(key);
      out[lvl] = this._bonusCoeffs[lvl] * incomeBase;
    }
    return out;
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

  /** % bonus a garrison's rolls get from being stationed on a tile of this
   * level, applied additively to the roll itself during an actual battle
   * (see BattleScreen) — it no longer inflates the static defence/power
   * number below, so a fortified tile fights tougher without pretending to
   * have more defenders than it really does. */
  getGarrisonBonusPct(level: number): number {
    return level >= 3 ? 0.2 : level === 2 ? 0.1 : 0;
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
      abandoned: this.abandoned,
      isYielded: this.isYielded,
    };
  }
}
