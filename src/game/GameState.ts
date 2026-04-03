export type TurnPhase = 'before-move' | 'rolling' | 'moving' | 'after-move';

import { Player } from './Player';
import { Tile } from './Tile';

export class GameState {
  tiles: Tile[];
  players: Player[];
  playerOrder: number[];
  activePlayerIndex: number;
  lastDice: number;
  turns: number = 0;
  circles: number = 0;
  round: number = 1;
  gameStarted: boolean = false;
  turnPhase: TurnPhase;
  gameMessage: string = '';
  gameOver: boolean = false;

  constructor(tiles: Tile[], players: Player[]) {
    this.tiles = tiles;
    this.players = players;
    this.playerOrder = this.shuffle(Array.from({ length: players.length }, (_, i) => i));
    this.activePlayerIndex = 0;
    this.lastDice = 1;
    this.turnPhase = 'before-move';
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

  get activeTile(): Tile {
    return this.tiles[this.activePlayer.position];
  }

  setPhase(phase: TurnPhase) {
    this.turnPhase = phase;
  }

  incTurns() {
    this.turns = this.turns + 1;
  }
}
