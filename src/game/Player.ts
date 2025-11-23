export interface PlayerParams {
  name: string;
  color: string;
  gold: number;
  units: number;
  position: number;
}

export class Player {
  name: string;
  color: string;
  gold: number;
  units: number;
  ownedTiles: number[];
  position: number;
  turnsToSkip: number;

  constructor(params: PlayerParams) {
    this.name = params.name;
    this.color = params.color;
    this.gold = params.gold;
    this.units = params.units;
    this.position = params.position;
    this.ownedTiles = [];
    this.turnsToSkip = 0;
  }
}
