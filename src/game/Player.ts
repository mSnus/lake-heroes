export interface PlayerParams {
  name: string;
  color: string;
  gold: number;
  units: number;
  position: number;
  image: string;
  leadership?: number;
}

export class Player {
  name: string;
  color: string;
  gold: number;
  units: number;
  ownedTiles: number[];
  position: number;
  image: string;
  turnsToSkip: number;
  leadership: number;

  constructor(params: PlayerParams) {
    this.name = params.name;
    this.color = params.color;
    this.gold = params.gold;
    this.units = params.units;
    this.position = params.position;
    this.image = params.image;
    this.ownedTiles = [];
    this.turnsToSkip = 0;
    this.leadership = params.leadership ?? 1;
  }
}
