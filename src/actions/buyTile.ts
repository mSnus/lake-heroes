import { GameState } from '../game/GameState';

export function buyTile(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  const player = board.activePlayer;
  const tile = board.tiles[player.position];

  console.log('Action: buy tile', player, tile);

  if (
    player.gold >= (tile.prices['1']?.gold ?? 0) &&
    player.units >= (tile.prices['1']?.units ?? 0) &&
    !tile.isOwned()
  ) {
    player.gold -= tile.prices['1']?.gold ?? 0;
    player.units -= tile.prices['1']?.units ?? 0;
    tile.owner = player.name;
    player.ownedTiles.push(player.position);
    updateGameState(board);
  }
}
