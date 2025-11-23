import { Player } from './Player';
import { Tile } from './Tile';

export class Board {
  tiles: Tile[];
  players: Player[];
  playerOrder: number[];
  activePlayerIndex: number;

  constructor(tiles: Tile[], players: Player[]) {
    this.tiles = tiles;
    this.players = players;
    this.playerOrder = this.shuffle(Array.from({ length: players.length }, (_, i) => i));
    this.activePlayerIndex = 0;
  }

  shuffle(arr: number[]): number[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  get activePlayer(): Player {
    return this.players[this.playerOrder[this.activePlayerIndex]];
  }
}
