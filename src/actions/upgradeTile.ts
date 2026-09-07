import { GameState } from '../game/GameState';

export function upgradeTile(
  tileIdx: number,
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  endTurn: () => void
) {
  if (!board) return;
  console.log('Action: upgrade tile');

  const player = board.activePlayer;
  const tile = board.tiles[tileIdx];

  if (tile.owner !== player.id) return;
  // Yielded tiles are with the King and earn nothing -- not upgradable,
  // same rule the UI (TileCard/TileClaimScreen) and the bots enforce.
  if (tile.isYielded) return;

  const currentlevel = tile.level;

  if (currentlevel >= 3) return;

  const nextlevel = (currentlevel + 1) as 2 | 3;

  const price = tile.prices[nextlevel];

  if (!price) return;
  if (player.gold >= price) {
    player.gold -= price;
    tile._level = nextlevel;
    updateGameState(board);
  }

  endTurn();
}
