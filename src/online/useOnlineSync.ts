import { useCallback, useEffect, useRef } from 'react';
import { GameState } from '../game/GameState';
import { SavedGameState } from '../game/TileSet';
import { LogMessage } from '../components/GameLogModal';
import { rehydrateGameState } from '../game/rehydrate';
import { isLocalTurn } from '../game/seats';
import { beginTurn } from '../actions/beginTurn';
import { clearScreen } from '../utils/screenStore';
import { closeModal } from '../utils/diceStore';
import { resetEndTurn } from '../utils/endTurnStore';
import { resetForkChoice } from '../utils/forkChoiceStore';
import { say } from '../utils/say';
import { fetchState, fetchVersion } from './api';
import { appVersionMismatch, parseEnvelope } from './envelope';
import { getOnline, isOnlineGame, updateOnline } from './onlineStore';
import { clearLogDelta } from './sync';

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
        say(`Other players are on build ${other} — reload to match.`, 'error');
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

      const delta = parsed.meta._log ?? [];
      if (delta.length) setGameLog((prev) => [...prev, ...delta].slice(-500));

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
      const res = await fetchVersion(code);
      if (cancelled || !res.ok) return;
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
  }, [active, pull]);
}
