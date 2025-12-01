export interface TileParams {
  group: string;
  name: string;
  isOwnable: boolean;
  priceGold: number;
  priceUnits: number;
  upgradePrices: { [level: string]: { gold: number; units: number } };
  bonuses: { [level: string]: number };
  defences: { [level: string]: number };
  bonusType?: 'units' | 'gold';
  description?: string;
}

export class Tile {
  group: string;
  name: string;
  isOwnable: boolean;
  priceGold: number;
  priceUnits: number;
  upgradePrices: { [level: number]: { gold: number; units: number } };
  bonuses: { [level: number]: number };
  defences: { [level: number]: number };
  owner?: string;
  level: number;
  bonusType?: 'units' | 'gold';
  description?: string;

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
    this.description = params.description;
  }

  isOwned(): boolean {
    return !!this.owner;
  }
}
