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
  owner?: string | null;
  level?: number;
  description?: string;
  sprite?: { x: number; y: number };
}

export class Tile implements TileJSON {
  group: string;
  name: string;
  isOwnable: boolean;
  bonusType: 'gold' | 'units';
  prices: { [level: number]: { gold: number; units: number } };
  bonuses: { [level: number]: number };
  defences: { [level: number]: number };
  owner?: string | null;
  _level?: number;
  description?: string;
  sprite?: { x: number; y: number };

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
  }

  get groupColor(): string {
    const meta = (groups as { name: string; icon: string; color: string }[]).find(
      (g) => g.name === this.group
    );
    return meta?.color ?? '#eee';
  }

  get level(): number {
    return this._level ?? 1;
  }

  get defence(): number {
    const level = this._level ?? 1;
    return this.getDefence(level);
  }

  get fee(): number {
    return this.defence * FEE_MULTIPLIER;
  }

  isOwned(): boolean {
    return !!this.owner;
  }

  isAffordable(playerGold: number, playerUnits: number): boolean {
    return playerGold >= this.prices['1'].gold && playerUnits >= this.prices['1'].units;
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
    const defence = this.defences ? this.defences[level] || 0 : 0;

    return level == 1 ? this.prices[1].units : defence;
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
    };
  }
}
