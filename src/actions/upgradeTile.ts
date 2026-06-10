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

  const currentlevel = tile.level;

  if (currentlevel >= 3) return;

  const nextlevel = (currentlevel + 1) as 2 | 3;

  const price = tile.prices[nextlevel];

  if (!price) return;
  if (player.gold >= price.gold && player.units >= price.units) {
    player.gold -= price.gold;
    player.units -= price.units;
    tile._level = nextlevel;
    updateGameState(board);
  }

  endTurn();
}
