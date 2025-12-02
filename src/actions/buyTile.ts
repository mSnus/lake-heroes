import { GameState } from '../game/GameState';

export function buyTile(board: GameState | null, setGameState: (board: GameState) => void) {
  if (!board) return;

  console.log('Action: buy tile');

  const player = board.activePlayer;
  const tile = board.tiles[player.position];

  if (player.gold >= tile.priceGold && player.units >= tile.priceUnits && !tile.isOwned()) {
    player.gold -= tile.priceGold;
    player.units -= tile.priceUnits;
    tile.owner = player.name;
    player.ownedTiles.push(player.position);
    setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));
  }
}
