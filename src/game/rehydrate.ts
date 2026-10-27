import { GameState } from './GameState';
import { Player } from './Player';
import { rehydrateSavedTiles, SavedGameState } from './TileSet';

/**
 * Keys that must never be blitted onto a rehydrated instance, because the
 * class exposes them as accessors rather than plain fields:
 *
 *  - `units` is a getter/setter pair on Player. Assigning it runs the SETTER,
 *    which grants militia -- so a payload carrying `units` would silently
 *    inflate the army on every load.
 *  - the rest are getter-ONLY. Assigning to one throws in strict mode (which
 *    ES modules always are), so a payload carrying them would break the load
 *    outright.
 *
 * None of these are own enumerable properties, so `JSON.stringify` omits them
 * today and this list is belt-and-braces. It stops mattering the moment
 * anything else serializes a GameState -- a server round-trip, a hand-edited
 * save, a future toJSON -- which is exactly what remote play introduces.
 */
const NON_ASSIGNABLE = new Set([
  'units',
  'activePlayer',
  'activeTile',
  'armyPower',
  'armyCapacity',
  // Pre-capacity getters an old save may still carry.
  'armySlots',
  'slotsUsed',
]);

/** Drop the keys above, plus any `_`-prefixed envelope metadata that rode
 * along with a remote payload (see online/envelope.ts). */
function assignable<T extends object>(raw: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('_') || NON_ASSIGNABLE.has(key)) continue;
    out[key] = value;
  }

  return out as Partial<T>;
}

/**
 * Rebuild a live GameState from its serialized form — the inverse of the plain
 * `JSON.stringify(gameState)` used for both the localStorage save and the
 * multiplayer payload, so the two can never drift.
 *
 * Two things here are load-bearing and easy to "tidy" into bugs:
 *
 *  1. `rehydrateSavedTiles` is not optional. `Tile.toJSON` emits `prices` and
 *     `bonuses` from getters as real gold, while the Tile constructor reads
 *     them as coefficients -- the round trip only closes because
 *     rehydrateSavedTiles re-reads those from tiles.json.
 *  2. The Player `Object.assign` order matters. `new Player(p)` sets
 *     `militia = p.units`, which is `undefined` in serialized form; the assign
 *     that follows is what puts `militia`/`riders` back. Collapsing the two
 *     loses the army.
 */
export function rehydrateGameState(savedRaw: SavedGameState): GameState {
  const tiles = rehydrateSavedTiles(savedRaw);

  // new Player() resets ownedTiles/turnsToSkip/circles/etc; copy the saved
  // fields back so per-player state survives. The 1-based id is derived from
  // array order, which is stable across save/load -- and which tile.owner,
  // kingsContracts.playerId and turnStats.playerId all reference, so the
  // player array's order must never be reshuffled in transit.
  const players = (savedRaw.players || []).map((p, i) =>
    Object.assign(new Player(p), assignable(p), { id: i + 1 })
  );

  const restored = Object.assign(new GameState(tiles, players), assignable(savedRaw), {
    tiles,
    players,
  });

  if (!restored.turnPhase) restored.turnPhase = 'before-move';
  restored.gameMessage = '';

  return restored;
}
