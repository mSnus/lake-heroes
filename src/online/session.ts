import { GameState } from '../game/GameState';
import { SavedGameState } from '../game/TileSet';
import { rehydrateGameState } from '../game/rehydrate';
import { say, sayLocal } from '../utils/say';
import { createGame, fetchState, SeatCode } from './api';
import { buildEnvelope, parseEnvelope } from './envelope';
import { clientId, clearOnlineSession, startOnlineSession, updateOnline } from './onlineStore';
import { clearLogDelta } from './sync';
import { resetLiveFeed, setCursor } from './liveFeedStore';

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
    sayLocal('Could not reach the game server — this game stays offline.', 'error');
    return null;
  }

  clearLogDelta();
  startOnlineSession({
    code: res.data.codes[0].code,
    seat: res.data.codes[0].playerIndex,
    seats: [res.data.codes[0].playerIndex],
    links: res.data.codes.map(() => false),
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
 * Join an existing game. Several codes at once (a bundle link) claim several
 * seats for this one browser, which is how players share a device: each seat is
 * still its own player with its own code on the server, and the ordinary
 * turn-handover already skips the push between two seats one browser drives.
 *
 * Every seat is whatever the server says its code owns — never guessed
 * client-side.
 */
export async function joinGame(codes: string[]): Promise<GameState | null> {
  const wanted = Array.from(new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean)));
  if (!wanted.length) return null;

  const results = [];
  for (const code of wanted) {
    const res = await fetchState(code);
    if (!res.ok) {
      sayLocal(
        res.kind === 'notfound' ? `No game found for code ${code}.` : 'Could not reach the game server.',
        'error'
      );
      return null;
    }

    results.push(res.data);
  }

  const first = results[0];
  const parsed = parseEnvelope(first.state);
  if (!parsed) {
    sayLocal('That game could not be read — it may have been saved by a different version.', 'error');
    return null;
  }

  const players = (parsed.raw.players ?? []) as { name?: string; color?: string }[];
  const seats = results.map((r) => r.playerIndex);
  // A code from some other game would otherwise seat a stranger here. The seat
  // it claims must exist in THIS board and carry the colour the server has for it.
  const foreign = results.some((r) => players[r.playerIndex]?.color !== r.color);
  if (foreign || new Set(seats).size !== seats.length) {
    sayLocal('Those codes do not belong to the same game.', 'error');
    return null;
  }

  clearLogDelta();
  startOnlineSession({
    code: wanted[0],
    seat: first.playerIndex,
    seats,
    // Only the creator hosts; a joiner never drives the bot seats.
    isHost: false,
    version: first.version,
    status: first.status,
    // What this device holds, so the 🔗 screen can show the bundle it opened.
    codes: results.map((r, i) => ({
      code: wanted[i],
      playerIndex: r.playerIndex,
      color: r.color,
      name: players[r.playerIndex]?.name ?? '',
    })),
  });

  // Start reading narration from here, not from the beginning of the game.
  resetLiveFeed();
  setCursor(first.lastEvent ?? 0);

  const board = rehydrateGameState(parsed.raw as SavedGameState);
  updateOnline({ sync: 'ready' });
  return board;
}

/** Abandon the online game but keep playing locally. */
export function leaveOnlineGame(): void {
  clearOnlineSession();
  clearLogDelta();
  resetLiveFeed();
}
