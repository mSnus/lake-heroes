import { GameState } from '../game/GameState';
import { SavedGameState } from '../game/TileSet';
import { rehydrateGameState } from '../game/rehydrate';
import { say } from '../utils/say';
import { createGame, fetchState, SeatCode } from './api';
import { buildEnvelope, parseEnvelope } from './envelope';
import { clientId, clearOnlineSession, startOnlineSession, updateOnline } from './onlineStore';
import { clearLogDelta } from './sync';

/**
 * Publish a freshly created game and claim seat 0.
 *
 * The creating client's board is canonical — both the tile layout
 * (components/board/layout.ts shuffles it) and the turn order (GameState's
 * constructor shuffles playerOrder) are randomised locally, so nobody can join
 * until this upload lands.
 *
 * Returns the per-seat join codes to hand out, or null if the upload failed.
 */
export async function hostGame(board: GameState): Promise<SeatCode[] | null> {
  const payload = buildEnvelope(board, { senderSeat: 0, clientId, log: [] });
  const res = await createGame(payload);
  if (!res.ok) {
    say('Could not reach the game server — this game stays offline.', 'error');
    return null;
  }

  clearLogDelta();
  startOnlineSession({
    code: res.data.codes[0].code,
    seat: res.data.codes[0].playerIndex,
    isHost: true,
    version: res.data.version,
    status: 'active',
    // Kept so the host can re-open the list and hand out links later --
    // the server will not enumerate them again.
    codes: res.data.codes,
  });

  return res.data.codes;
}

/**
 * Join an existing game by code. The seat is whatever the server says the code
 * owns — it is never guessed client-side.
 */
export async function joinGame(code: string): Promise<GameState | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;

  const res = await fetchState(trimmed);
  if (!res.ok) {
    say(
      res.kind === 'notfound' ? `No game found for code ${trimmed}.` : 'Could not reach the game server.',
      'error'
    );
    return null;
  }

  const parsed = parseEnvelope(res.data.state);
  if (!parsed) {
    say('That game could not be read — it may have been saved by a different version.', 'error');
    return null;
  }

  clearLogDelta();
  startOnlineSession({
    code: trimmed,
    seat: res.data.playerIndex,
    // Only the creator hosts; a joiner never drives the bot seats.
    isHost: false,
    version: res.data.version,
    status: res.data.status,
  });

  const board = rehydrateGameState(parsed.raw as SavedGameState);
  updateOnline({ sync: 'ready' });
  return board;
}

/** Abandon the online game but keep playing locally. */
export function leaveOnlineGame(): void {
  clearOnlineSession();
  clearLogDelta();
}
