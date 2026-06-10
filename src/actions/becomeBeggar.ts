import { GameState } from '../game/GameState';
import { changeFame } from '../utils/fame';
import { say } from '../utils/say';

export function becomeBeggar(board: GameState, updateGameState: (board: GameState) => void) {
  const player = board.activePlayer;

  say(`${player.name} becomes a beggar!`, 'error');

  // 1. If player has any tiles, they are set unowned, level 1 (and all upgrades are removed)
  let lostTilesCount = 0;
  board.tiles.forEach((tile) => {
    if (tile.owner === player.id) {
      tile.owner = null;
      tile._level = 1;
      lostTilesCount++;
    }
  });
  player.ownedTiles = [];

  // 2. Player loses half of his units (rounded up to 1)
  const loss = Math.ceil(player.units / 10);
  player.units -= loss;
  if (player.units < 0) player.units = 0;

  // 3. Player looses all gold
  player.gold = 0;

  say(`${loss} units leave ${player.name} as his reputation vanishes`, 'warning');
  changeFame(player, -1);

  // 4. Moved to prison
  // Prison index is 13.
  player.position = 13;
  player.turnsToSkip = 1;

  say(`${player.name} is captured and moved to Prison`, 'warning');

  const tilesMsg =
    lostTilesCount > 0 ? `Lost ${lostTilesCount} tile${lostTilesCount > 1 ? 's' : ''} and ` : '';
  const lostUnitsMsg = loss > 0 ? `${loss} unit${loss !== 1 ? 's' : ''} deserted` : ``;
  board.gameMessage = `${player.name} became a prisoner of war! ${tilesMsg}${lostUnitsMsg}. Imprisoned, but still noble.`;

  updateGameState(board);
}
