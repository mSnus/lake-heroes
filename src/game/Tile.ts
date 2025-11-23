export type UpgradeLevel = 1 | 2 | 3;

export interface TileParams {
  group: string;
  name: string;
  isOwnable: boolean;
  priceGold: number;
  priceUnits: number;
  upgradePrices: { [level: string]: { gold: number; units: number } };
  bonuses: { [level: string]: number };
  defences: { [level: string]: number };
  /**
   * What type of bonus this tile yields when fees/bonuses are applied.
   * Optional to keep backward compatibility with existing data.
   * Camps and Towers → 'units'; other ownable tiles → 'gold'.
   */
  bonusType?: 'units' | 'gold';
}

export class Tile {
  group: string;
  name: string;
  isOwnable: boolean;
  priceGold: number;
  priceUnits: number;
  upgradePrices: { [level: string]: { gold: number; units: number } };
  bonuses: { [level: string]: number };
  defences: { [level: string]: number };
  owner?: string;
  level: UpgradeLevel;
  bonusType?: 'units' | 'gold';

  constructor(params: TileParams) {
    this.group = params.group;
    this.name = params.name;
    this.isOwnable = params.isOwnable;
    this.priceGold = params.priceGold;
    this.priceUnits = params.priceUnits;
    this.upgradePrices = params.upgradePrices;
    this.bonuses = params.bonuses;
    this.defences = params.defences;
    this.owner = undefined;
    this.level = 1;
    this.bonusType = params.bonusType;
  }

  isOwned(): boolean {
    return !!this.owner;
  }
}
