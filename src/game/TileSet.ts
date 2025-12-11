import { Tile, TileJSON } from './Tile';
import { buildTileLayoutFromTemplates } from '../components/board/layout';

// Build Tile instances from the raw templates list by running the existing layout algorithm
export function buildTilesFromTemplates(allTemplates: TileJSON[]): Tile[] {
  // buildTileLayoutFromTemplates expects the raw templates array and returns placed templates (may contain undefined)
  const placedTemplates = buildTileLayoutFromTemplates(allTemplates as any);
  return placedTemplates.map((t) => new Tile(t as Tile));
}

// Rehydrate saved tiles (plain objects) into Tile instances so methods / prototype are restored
export function rehydrateSavedTiles(savedRaw: { tiles?: TileJSON[] }): Tile[] {
  const rawTiles = savedRaw.tiles || [];
  return rawTiles.map((t) => new Tile(t) as Tile);
}
