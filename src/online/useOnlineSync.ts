import { useCallback, useEffect, useRef } from 'react';
import { GameState } from '../game/GameState';
import { SavedGameState } from '../game/TileSet';
import { LogMessage } from '../components/menu/GameLogModal';
import { rehydrateGameState } from '../game/rehydrate';
import { isLocalTurn } from '../game/seats';
import { beginTurn } from '../actions/beginTurn';
import { clearScreen } from '../utils/screenStore';
import { closeModal } from '../utils/diceStore';
import { resetEndTurn } from '../utils/endTurnStore';
import { resetForkChoice } from '../utils/forkChoiceStore';
import { sayLocal, showToast, SayLevel } from '../utils/say';
import { fetchState, fetchVersion } from './api';
import { appVersionMismatch, parseEnvelope } from './envelope';
import { getOnline, isOnlineGame, updateOnline } from './onlineStore';
import { clearLogDelta } from './sync';
import {
  getLiveFeed,
  resetLiveFeed,
  retireLiveBanner,
  setCursor,
  setLiveBanner,
} from './liveFeedStore';
import { retireRemoteMove, replayRemoteMoves, RemoteMove } from './remoteMoveStore';
import { RemoteEvent } from './api';

/** How often to ask the server whether anything changed. Only the version
 * counter is fetched at this cadence — the full board is pulled only when it
 * actually moves (see server/routes/api.php). */
const POLL_MS = 4000;

interface Options {
  gameState: GameState | null;
  setGameState: (board: GameState) => void;
  setGameLog: (fn: (prev: LogMessage[]) => LogMessage[]) => void;
  updateGameState: (board: GameState) => void;
  /** Opens the dice for the local player — called when a pull makes it our turn. */
  startLocalTurn: (board: GameState) => void;
}

/**
 * Keeps this client's board in step with the server while it is somebody
 * else's turn.
 *
 * Only ever pulls when it is NOT our turn. During our own turn the local board
 * is deliberately ahead of the server — beginTurn has already collected our
 * income and we have not pushed yet — so applying a remote state here would
 * throw that away and, on the next handover, collect it twice.
 */
export function useOnlineSync({
  gameState,
  setGameState,
  setGameLog,
  updateGameState,
  startLocalTurn,
}: Options): void {
  const pulling = useRef(false);
  const warnedVersion = useRef(false);

  /**
   * Show narration from whoever is on turn.
   *
   * `showToast` and a direct log append — never `say()`. The streamer listens
   * on the global `logMessage` event, so rendering a received line through
   * `say()` would push it straight back into our own outbound buffer and
   * rebroadcast it on our next turn.
   */
  const renderEvents = useCallback(
    (events: RemoteEvent[], appliedVersion: number) => {
      const moveSteps: RemoteMove[] = [];
      for (const e of events) {
        // A straggler from a turn whose state we already have.
        if (e.version < appliedVersion) continue;
        // narrateMove()'s piggybacked hop -- never shown as a toast (see
        // online/stream.ts); collected to replay at its own pace below
        // instead of applying every hop from this poll at once.
        if (e.kind === 'toast' && e.level === 'move') {
          const position = Number(e.message);
          if (Number.isFinite(position)) moveSteps.push({ seat: e.seat, position, seq: e.seq });
          continue;
        }

        if (e.kind === 'banner') setLiveBanner(e.message, e.seq);
        else {
          showToast(e.message, e.level as SayLevel);
          setGameLog((prev) =>
            [...prev, { message: e.message, level: e.level as SayLevel, timestamp: Date.now() }].slice(-500)
          );
        }
      }

      if (moveSteps.length) void replayRemoteMoves(moveSteps);
      if (events.length) setCursor(events[events.length - 1].seq);
    },
    [setGameLog]
  );

  const pull = useCallback(async () => {
    const { code } = getOnline();
    if (!code || pulling.current) return;
    pulling.current = true;
    try {
      const res = await fetchState(code);
      if (!res.ok) {
        updateOnline({
          sync: 'error',
          error: res.kind === 'notfound' ? 'notfound' : 'network',
        });
        return;
      }

      const parsed = parseEnvelope(res.data.state);
      if (!parsed) {
        // Corrupt payload: leave the local board alone rather than half-apply.
        updateOnline({ sync: 'error', error: 'bad-payload' });
        return;
      }

      // Tile prices, garrison capacity and income are re-derived from each
      // client's own tiles.json, so a build skew means the two players are
      // playing subtly different economies. Warn once rather than every poll.
      const other = appVersionMismatch(parsed.meta);
      if (other && !warnedVersion.current) {
        warnedVersion.current = true;
        sayLocal(`Other players are on build ${other} — reload to match.`, 'error');
      }

      const board = rehydrateGameState(parsed.raw as SavedGameState);

      // Everything below is this client's own UI state, not the game's: a
      // screen left over from our last turn, a dice modal, a half-made fork
      // choice. None of it belongs to the board we just received.
      clearScreen();
      closeModal();
      resetEndTurn();
      resetForkChoice();
      clearLogDelta();

      // The turn's narration has normally already arrived live, line by line,
      // via the event stream -- so this only fills the log, and only with what
      // the stream did NOT deliver (its posts can fail; the envelope's copy
      // cannot, which is what keeps streaming a pure enhancement).
      const delta = parsed.meta._log ?? [];
      if (delta.length) setGameLog((prev) => [...prev, ...delta].slice(-500));

      // The banner (and the board's own player.position) in the applied
      // state supersedes any live one up to here.
      retireLiveBanner(parsed.meta._eventsThrough ?? Number.MAX_SAFE_INTEGER);
      retireRemoteMove(parsed.meta._eventsThrough ?? Number.MAX_SAFE_INTEGER);

      updateOnline({
        version: res.data.version,
        status: res.data.status,
        sync: 'ready',
        error: undefined,
      });

      setGameState(board);

      // Our turn now: run the turn-start work the previous player deliberately
      // left for us (see actions/beginTurn.ts), then hand over to the dice.
      if (isLocalTurn(board)) {
        beginTurn(board, updateGameState);
        startLocalTurn(board);
      }
    } finally {
      pulling.current = false;
    }
  }, [setGameState, setGameLog, updateGameState, startLocalTurn]);

  const myTurn = !!gameState && isLocalTurn(gameState);
  const finished = getOnline().status === 'finished';
  const active = isOnlineGame() && !!gameState && !myTurn && !finished;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const { code, version } = getOnline();
      if (!code) return;
      const { cursor } = getLiveFeed();
      const res = await fetchVersion(code, cursor);
      if (cancelled || !res.ok) return;

      // Narration first, so it precedes the board jump rather than trailing it.
      if (res.data.events?.length) {
        const oldest = res.data.oldestEvent ?? 0;
        if (cursor > 0 && oldest > cursor + 1) {
          // We fell behind retention; skip the gap rather than wait for rows
          // that no longer exist. The state pull fills the log.
          setCursor(res.data.lastEvent);
        } else {
          renderEvents(res.data.events, version ?? 0);
        }
      }

      if (res.data.version > (version ?? 0)) await pull();
      else if (res.data.status === 'finished') updateOnline({ status: 'finished' });
    };

    const id = setInterval(tick, POLL_MS);
    // Background tabs throttle setInterval to roughly once a minute, which
    // would otherwise stall every bot turn while the host is on another tab.
    const onFocus = () => void tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    void tick();

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, pull, renderEvents]);
}
