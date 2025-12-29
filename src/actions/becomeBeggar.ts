import { GameState } from '../game/GameState';
import { say } from '../utils/say';

export function becomeBeggar(
  board: GameState,
  updateGameState: (board: GameState) => void
) {
  const player = board.activePlayer;

  say(`${player.name} becomes a beggar!`, 'error');

  // 1. If player has any tiles, they are set unowned, level 1 (and all upgrades are removed)
  let lostTilesCount = 0;
  board.tiles.forEach((tile) => {
    if (tile.owner === player.name) {
      tile.owner = null;
      tile._level = 1;
      lostTilesCount++;
    }
  });


  // 2. Player loses half of his units (rounded up to 1)
  const loss = Math.ceil(player.units / 2);
  player.units -= loss;
  if (player.units < 0) player.units = 0;

  say(`${loss} units leave ${player.name} as his reputation vanishes`, 'warning');

  // 3. Moved to prison with skipTurns = 2
  // Prison index is 13.
  player.position = 13;
  player.turnsToSkip = 2;

  say(`${player.name} is in Prison for mendicancy (2 turns)`, 'warning');

  updateGameState(board);
}
