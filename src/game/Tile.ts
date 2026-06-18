import { FEE_MULTIPLIER } from './constants';
import groups from '../settings/groups.json';

export interface TileJSON {
  group: string;
  name: string;
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
}

export class Tile implements TileJSON {
  group: string;
  name: string;
  isOwnable: boolean;
  bonusType: 'gold' | 'units';
  prices: { [level: number]: { gold: number; units: number } };
  bonuses: { [level: number]: number };
  defences: { [level: number]: number };
  owner?: number | null;
  _level?: number;
  description?: string;
  sprite?: { x: number; y: number };
  spriteImage?: string;
  requiredFame: number;
  fog: boolean;

  constructor(data: Partial<TileJSON> = {}) {
    this.group = data.group || '';
    this.name = data.name || '';
    this.isOwnable = !!data.isOwnable;
    this.bonusType = data.bonusType || 'gold';
    this.prices = Object.assign({}, data.prices || {});
    this.bonuses = Object.assign({}, data.bonuses || {});
    this.defences = Object.assign({}, data.defences || {});
    this.owner = data.owner ?? null;
    this._level = typeof data.level === 'number' ? data.level : 1;
    this.description = data.description;
    this.sprite = data.sprite;
    this.spriteImage = data.spriteImage;
    this.requiredFame = data.requiredFame ?? 0;
    this.fog = data.fog !== false && this.isOwnable;
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

  isAffordable(playerGold: number, playerUnits: number, playerFame: number): boolean {
    return (
      playerGold >= this.prices['1'].gold &&
      playerUnits >= this.prices['1'].units &&
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
      priceUnits += this.prices[lvl].units || 0;
    }

    return { gold: priceGold, units: priceUnits };
  }

  getBonus(level: number = 1): number {
    return this.bonuses ? this.bonuses[level] || 0 : 0;
  }

  getDefence(level: number = 1): number {
    // Experiment: defence = sum of prices.units up to the given level.
    let units = 0;
    for (let lvl = 1; lvl <= level; lvl++) {
      units += (this.prices[lvl]?.units || 2) * (level < 3 ? 2 : 1.5);
    }

    return Math.ceil(units);
  }

  toJSON(): TileJSON {
    return {
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
    };
  }
}
