export interface PlayerParams {
  id?: number;
  name: string;
  color: string;
  gold: number;
  units: number;
  position: number;
  image: string;
  fame?: number;
}

export class Player {
  // Stable 1-based identity used for tile ownership and player lookups.
  id: number;
  name: string;
  color: string;
  gold: number;
  units: number;
  ownedTiles: number[];
  position: number;
  image: string;
  turnsToSkip: number;
  fame: number;
  circles: number;
  dragonEncounters: number;
  dragonEncounteredLastTurn: boolean;
  caravanEncounters: number;
  caravanEncounteredLastTurn: boolean;
  unitsHiredThisTurn: number;
  isPrisonerOfWar: boolean;
  hasClaimedThisTurn: boolean;
  hasBeenOfferedDragonChallenge: boolean;

  constructor(params: PlayerParams) {
    this.id = params.id ?? 0;
    this.name = params.name;
    this.color = params.color;
    this.gold = params.gold;
    this.units = params.units;
    this.position = params.position;
    this.image = params.image;
    this.ownedTiles = [];
    this.turnsToSkip = 0;
    this.fame = params.fame ?? 1;
    this.circles = 0;
    this.dragonEncounters = 0;
    this.dragonEncounteredLastTurn = false;
    this.caravanEncounters = 0;
    this.caravanEncounteredLastTurn = false;
    this.unitsHiredThisTurn = 0;
    this.isPrisonerOfWar = false;
    this.hasClaimedThisTurn = false;
    this.hasBeenOfferedDragonChallenge = false;
  }
}
