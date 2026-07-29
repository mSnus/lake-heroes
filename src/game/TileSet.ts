import { Tile, TileJSON } from './Tile';
import { PlayerParams } from './Player';
import { TurnPhase } from './GameState';
import { buildTileLayoutFromTemplates } from '../components/board/layout';
import tilesData from '../settings/tiles.json';

/** Shape of a GameState serialized to localStorage */
export interface SavedGameState {
  tiles?: TileJSON[];
  players?: PlayerParams[];
  playerOrder?: number[];
  activePlayerIndex?: number;
  lastDice?: number;
  turns?: number;
  circles?: number;
  gameStarted?: boolean;
  turnPhase?: TurnPhase;
  gameMessage?: string;
  gameOver?: boolean;
}

// Build Tile instances from the raw templates list by running the existing layout algorithm
export function buildTilesFromTemplates(allTemplates: TileJSON[]): Tile[] {
  // buildTileLayoutFromTemplates expects the raw templates array and returns placed templates (may contain undefined)
  const placedTemplates = buildTileLayoutFromTemplates(allTemplates as any);
  return placedTemplates.map((t) => new Tile(t as Tile));
}

const tileTemplatesByName = new Map<string, TileJSON>(
  (tilesData as TileJSON[]).map((t) => [t.name, t])
);

// Rehydrate saved tiles (plain objects) into Tile instances so methods / prototype are restored.
// Saves from before the garrison system existed have no `garrison` key at all — backfill it
// from the current tiles.json template so those tiles don't come back with 0 defence.
export function rehydrateSavedTiles(savedRaw: SavedGameState): Tile[] {
  const rawTiles = savedRaw.tiles || [];
  return rawTiles.map((t) => {
    if (t.garrison === undefined) {
      const fresh = tileTemplatesByName.get(t.name);
      if (fresh?.garrison !== undefined) {
        t = { ...t, garrison: fresh.garrison, baseGarrison: fresh.garrison };
      }
    }
    return new Tile(t) as Tile;
  });
}
