import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { fightTile } from './fightTile';
import { claimUndefendedTile } from './claimUndefendedTile';

/** Serving a prison sentence, or standing on the Prison tile. */
export const isJailed = (board: GameState, player: Player): boolean =>
  (player.turnsToSkip ?? 0) > 0 || board.tiles[player.position]?.id === 'prison';

/** The active player may attack the tile they stand on while its owner is jailed. */
export function canRazeJailedTile(board: GameState): boolean {
  const player = board.activePlayer;
  const tile = board.activeTile;
  const owner = board.players.find((p) => p.id === tile.owner);
  return (
    board.turnPhase === 'after-move' &&
    !!owner &&
    owner.id !== player.id &&
    !tile.isYielded &&
    isJailed(board, owner) &&
    !player.hasResolvedTileEncounterThisTurn &&
    player.armyPower > 0
  );
}

/** An empty garrison is simply taken, as at the guards screen; otherwise the guards are fought. */
export function razeJailedTile(board: GameState, updateGameState: (board: GameState) => void): void {
  if (!canRazeJailedTile(board)) return;
  if (board.activeTile.garrison <= 0) claimUndefendedTile(board, updateGameState);
  else fightTile(board, updateGameState);
}
