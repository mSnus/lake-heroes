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
  level?: number;
  description?: string;

  constructor(data: Partial<TileJSON> = {}) {
    this.group = data.group || '';
    this.name = data.name || '';
    this.isOwnable = !!data.isOwnable;
    this.bonusType = data.bonusType || 'gold';
    this.prices = Object.assign({}, data.prices || {});
    this.bonuses = Object.assign({}, data.bonuses || {});
    this.defences = Object.assign({}, data.defences || {});
    this.owner = data.owner ?? null;
    this.level = typeof data.level === 'number' ? data.level : 1;
    this.description = data.description;
  }

  isOwned(): boolean {
    return !!this.owner;
  }

  ownedBy(): string | null {
    return this.owner || null;
  }

  isAffordable(playerGold: number, playerUnits: number): boolean {
    return playerGold >= this.prices["1"].gold && playerUnits >= this.prices["1"].units;
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
    if (level === 1) return { gold: this.prices["1"].gold || 0, units: this.prices["1"].units || 0 };
    const up = this.prices && this.prices[key];
    return { gold: up?.gold || 0, units: up?.units || 0 };
  }

  getBonus(level: number = 1): number {
    return this.bonuses ? this.bonuses[level] || 0 : 0;
  }

  getDefence(level: number = 1): number {
    return this.defences ? this.defences[level] || 0 : 0;
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
    };
  }
}
