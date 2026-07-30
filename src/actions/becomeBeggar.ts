import { GameState } from '../game/GameState';
import { changeFame } from '../utils/fame';
import { say } from '../utils/say';
import { t } from '../i18n';

export function becomeBeggar(board: GameState, updateGameState: (board: GameState) => void) {
  const player = board.activePlayer;

  say(t('becomeBeggar.becomesBeggar', { playerName: player.name }), 'error');

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

  say(t('becomeBeggar.unitsLeave', { units: loss, playerName: player.name }), 'warning');
  changeFame(player, -1);

  // 4. Moved to prison
  // Prison index is 13.
  player.position = 13;
  player.turnsToSkip = 1;

  say(t('becomeBeggar.capturedAndMoved', { playerName: player.name }), 'warning');

  const tilesMsg =
    lostTilesCount > 0
      ? t(lostTilesCount === 1 ? 'becomeBeggar.lostTileSingular' : 'becomeBeggar.lostTilesPlural', {
          count: lostTilesCount,
        })
      : '';
  const lostUnitsMsg =
    loss > 0
      ? t(loss === 1 ? 'becomeBeggar.unitDesertedSingular' : 'becomeBeggar.unitsDesertedPlural', {
          count: loss,
        })
      : '';
  board.gameMessage = t('becomeBeggar.gameMessage', {
    playerName: player.name,
    tilesMsg,
    lostUnitsMsg,
  });

  updateGameState(board);
}
