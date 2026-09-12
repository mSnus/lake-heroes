import { GameState } from '../game/GameState';
import { SavedGameState } from '../game/TileSet';
import { LogMessage } from '../components/GameLogModal';

/** Bumped only if the payload shape changes incompatibly. */
export const ENVELOPE_SCHEMA = 1;

/**
 * How many recent log lines ride along with a turn. This is a delta, not the
 * history: the receiver appends it, so sending the whole 500-entry log would
 * both triple the payload and re-narrate the entire game on every sync.
 */
export const LOG_DELTA_CAP = 40;

/**
 * Metadata that travels alongside the game state. Underscore-prefixed and kept
 * as *siblings* of the GameState fields rather than nesting the state under a
 * key, because the server reads `players` and `gameOver` from the top level
 * (GameController mints one join code per `players[]` entry and derives
 * `status` from `gameOver`). Keeping them where it expects means the server
 * needs no schema change at all.
 *
 * rehydrateGameState strips every `_` key, so none of this reaches GameState.
 */
export interface EnvelopeMeta {
  _schema: number;
  /** Build tag of the client that wrote this (VITE_APP_VERSION). Tile prices,
   * garrison capacity and income are re-derived from each client's OWN
   * settings/tiles.json on load, so two clients on different builds compute
   * different economies from identical state. Carrying the version lets the
   * receiver notice. */
  _appVersion?: string;
  /** Seat that produced this state. */
  _senderSeat: number;
  /** Browser that produced it — distinguishes our own writes from those of
   * someone else holding the same join code (the server has no sessions). */
  _lastWriter: string;
  /** Log lines produced during the turn just played. Still sent even though
   * narration now streams live: this is what keeps the feature a pure
   * enhancement, arriving intact when the event posts failed. The receiver
   * skips whatever the stream already delivered (see _eventsThrough). */
  _log: LogMessage[];
  /** Highest event seq the sender had shipped when this state was pushed, so
   * the receiver can tell which _log lines it has already seen. */
  _eventsThrough?: number;
}

export type Envelope = SavedGameState & EnvelopeMeta;

/**
 * Serialize a finished turn for upload. Plain `JSON.stringify` of the
 * GameState, exactly as the localStorage save does — that round trip is
 * exercised on every page reload, so reusing it verbatim is what keeps the
 * remote path from developing its own serialization bugs.
 */
export function buildEnvelope(
  board: GameState,
  meta: { senderSeat: number; clientId: string; log: LogMessage[]; eventsThrough?: number }
): string {
  const envelope = {
    ...(JSON.parse(JSON.stringify(board)) as SavedGameState),
    _schema: ENVELOPE_SCHEMA,
    _appVersion: import.meta.env?.VITE_APP_VERSION,
    _senderSeat: meta.senderSeat,
    _lastWriter: meta.clientId,
    _log: meta.log.slice(-LOG_DELTA_CAP),
    _eventsThrough: meta.eventsThrough,
  };

  return JSON.stringify(envelope);
}

export interface ParsedEnvelope {
  raw: SavedGameState;
  meta: Partial<EnvelopeMeta>;
}

/** Split a received payload into the game state and its metadata. Returns null
 * for anything unparseable or obviously not a game — a corrupt payload must
 * leave the local game untouched rather than half-applied. */
export function parseEnvelope(json: string): ParsedEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.players) || obj.players.length === 0) return null;
  if (!Array.isArray(obj.tiles) || obj.tiles.length === 0) return null;

  const meta: Partial<EnvelopeMeta> = {
    _schema: typeof obj._schema === 'number' ? obj._schema : undefined,
    _appVersion: typeof obj._appVersion === 'string' ? obj._appVersion : undefined,
    _senderSeat: typeof obj._senderSeat === 'number' ? obj._senderSeat : undefined,
    _lastWriter: typeof obj._lastWriter === 'string' ? obj._lastWriter : undefined,
    _log: Array.isArray(obj._log) ? (obj._log as LogMessage[]) : [],
    _eventsThrough: typeof obj._eventsThrough === 'number' ? obj._eventsThrough : undefined,
  };

  return { raw: obj as SavedGameState, meta };
}

/**
 * Does this payload come from a client running a different build? Only
 * meaningful when both sides have a version baked in — a local `npm run build`
 * has none, so a dev client never trips this.
 */
export function appVersionMismatch(meta: Partial<EnvelopeMeta>): string | null {
  const mine = import.meta.env?.VITE_APP_VERSION;
  const theirs = meta._appVersion;
  if (!mine || !theirs || mine === theirs) return null;
  return theirs;
}
