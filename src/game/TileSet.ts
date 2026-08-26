import { Tile, TileJSON } from './Tile';
import { PlayerParams } from './Player';
import { TurnPhase } from './GameState';
import { buildTileLayoutFromTemplates } from '../components/board/layout';
import tilesData from '../settings/tiles.json';
import enLocale from '../i18n/locales/en.json';

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

const tileTemplatesById = new Map<string, TileJSON>(
  (tilesData as TileJSON[]).map((t) => [t.id, t])
);
// Saves from before the stable `id` field existed stored the English display
// name directly (tiles.json no longer carries a name at all — it's translated
// from the locale files now). This reverse lookup exists ONLY to backfill
// `id` on those old saves; nothing else should ever key off a tile's name.
const legacyIdByName = new Map<string, string>(
  Object.entries(enLocale.tiles as Record<string, { name: string }>).map(([id, v]) => [v.name, id])
);

// Rehydrate saved tiles (plain objects) into Tile instances so methods / prototype are restored.
// Saves from before the garrison system existed have no `garrison` key at all — backfill it
// from the current tiles.json template so those tiles don't come back with 0 defence. Saves
// from before the stable `id` field existed have no `id` at all — backfill that too (matching
// by the English name they were saved under).
export function rehydrateSavedTiles(savedRaw: SavedGameState): Tile[] {
  const rawTiles = savedRaw.tiles || [];
  return rawTiles.map((t) => {
    if (!t.id && t.name) {
      const legacyId = legacyIdByName.get(t.name);
      if (legacyId) t = { ...t, id: legacyId };
    }

    const fresh = tileTemplatesById.get(t.id);
    if (t.garrison === undefined && fresh?.garrison !== undefined) {
      t = { ...t, garrison: fresh.garrison, baseGarrison: fresh.garrison };
    }

    // Balance data (prices/bonuses/defences/annual reward) is authored in
    // tiles.json, not player progress — always pull the current values
    // instead of trusting whatever was baked into the save when the tile
    // was first serialized, or a rebalance never reaches a game that's
    // already in progress.
    if (fresh) {
      t = {
        ...t,
        prices: fresh.prices,
        bonuses: fresh.bonuses,
        defences: fresh.defences,
        annualGoldMult: fresh.annualGoldMult,
        annualUnits: fresh.annualUnits,
      };
    }

    return new Tile(t) as Tile;
  });
}
