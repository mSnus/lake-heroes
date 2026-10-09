import { GameState } from '../game/GameState';
import { changeFame } from '../utils/fame';
import { say } from '../utils/say';
import { setGameMessage } from '../utils/gameMessage';
import { t } from '../i18n';

export function becomeBeggar(board: GameState, updateGameState: (board: GameState) => void) {
  const player = board.activePlayer;

  player.hasResolvedTileEncounterThisTurn = true;

  // 1. If player has any tiles, they are set unowned, level 1 (and all upgrades are removed)
  let lostTilesCount = 0;
  board.tiles.forEach((tile) => {
    if (tile.owner === player.id) {
      tile.owner = null;
      tile._level = 1;
      tile.isYielded = false;
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

  // Silent -- folded into the single combined toast below instead of its
  // own "is now of fame" line.
  changeFame(player, -1, 1, true);

  // 4. Moved to prison -- found by id, never a hardcoded index. The board
  // order is built by buildTileLayoutFromTemplates, which places tiles
  // rather than preserving tiles.json's order, so a literal index silently
  // points at whatever tile happens to land there (it used to say 13, which
  // is the Sphynx).
  const prisonIdx = board.tiles.findIndex((t) => t?.id === 'prison');
  if (prisonIdx >= 0) player.position = prisonIdx;
  player.turnsToSkip = 1;

  // One combined toast rather than four separate ones (capture, fame,
  // units-leave, becomes-a-beggar) -- the unit tally reports what's
  // actually left (post-loss), each tier omitted if it's zero.
  const remaining: string[] = [];
  if (player.militia > 0) remaining.push(`${player.militia}🧍`);
  if (player.riders > 0) remaining.push(`${player.riders}🐎`);
  const unitsPart =
    remaining.length > 0 ? t('becomeBeggar.hasOnly', { units: remaining.join(' ') }) : '';
  say(
    t('becomeBeggar.captured', { playerName: player.name, fame: player.fame, unitsPart }),
    'error'
  );

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
  setGameMessage(
    board,
    t('becomeBeggar.gameMessage', {
      playerName: player.name,
      tilesMsg,
      lostUnitsMsg,
    })
  );

  updateGameState(board);
}
