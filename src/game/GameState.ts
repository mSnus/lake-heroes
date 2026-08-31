export type TurnPhase = 'before-move' | 'rolling' | 'moving' | 'after-move';

/** Cheat-forced random encounter (see GameState.forcedEncounter). */
export type ForcedEncounter = 'dragon' | 'caravan-gold' | 'caravan-slaves' | 'caravan-horses' | 'rogue';

import { Player } from './Player';
import { Tile } from './Tile';
import { KingsContract } from './kingsContracts';
import type { PlayerTurnStat, PlayerStatEvent } from './statistics';

export class GameState {
  tiles: Tile[];
  players: Player[];
  playerOrder: number[];
  activePlayerIndex: number;
  lastDice: number;
  turns: number = 0;
  round: number = 1;
  gameStarted: boolean = false;
  turnPhase: TurnPhase;
  gameMessage: string = '';
  kingRewardMessage: string = '';
  kingsContracts: KingsContract[] = [];
  gameOver: boolean = false;
  // True while the active player is serving a skipped (prison) turn — persisted
  // so a reload doesn't offer them the dice.
  skippingTurn: boolean = false;
  // Per-player-per-turn history for the Statistics screen.
  turnStats: PlayerTurnStat[] = [];
  statEvents: PlayerStatEvent[] = [];
  // Cheat (👻 screen): forces the named random encounter to fire on the next
  // roll, bypassing its usual odds/eligibility, then clears itself.
  forcedEncounter?: ForcedEncounter;

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
