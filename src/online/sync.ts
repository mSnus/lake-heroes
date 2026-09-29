import { GameState } from '../game/GameState';
import { LogMessage } from '../components/GameLogModal';
import { buildEnvelope, LOG_DELTA_CAP } from './envelope';
import { pushState } from './api';
import { clientId, getOnline, updateOnline } from './onlineStore';
import { eventsSentThrough } from './stream';

/**
 * Log lines produced since the last successful push, so a turn can carry its
 * own narration to the other players (they never watch the turn happen, so
 * this is all they get). Buffered here off the same `logMessage` event App
 * listens to, rather than reaching into React state, which keeps the sync path
 * usable from plain game actions.
 */
let logDelta: LogMessage[] = [];

if (typeof window !== 'undefined') {
  window.addEventListener('logMessage', (e: Event) => {
    const detail = (e as CustomEvent).detail as LogMessage;
    if (detail) logDelta = [...logDelta, detail].slice(-LOG_DELTA_CAP);
  });
}

/** Drop buffered lines without sending them — used when applying someone
 * else's state, whose narration arrives in their delta instead. */
export function clearLogDelta(): void {
  logDelta = [];
}

export type PushOutcome = 'sent' | 'stale' | 'failed' | 'offline';

const RETRY_DELAYS_MS = [1000, 3000];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Hand a finished turn to the server.
 *
 * Retries a couple of times on a network blip, because losing this write means
 * losing the turn: the other players would sit waiting forever on a state that
 * only exists in this browser. A `stale` result is NOT retried — it means
 * someone else already wrote, so re-sending would clobber them; the caller has
 * to resync instead.
 */
export function pushTurn(board: GameState): Promise<PushOutcome> {
  const { code, seat } = getOnline();
  if (code === undefined || seat === undefined) return Promise.resolve('offline');

  // The snapshot is taken now, while the board is what this handover produced.
  const payload = buildEnvelope(board, {
    senderSeat: seat,
    clientId,
    log: logDelta,
    eventsThrough: eventsSentThrough(),
  });

  // One push at a time. Handovers between seats on this device (hot-seat, host
  // bots) can follow each other faster than a request returns, and a second
  // push sent with the version the first has not yet bumped would be refused as
  // stale -- by our own write. Queued, each one reads the version when it runs.
  const sentLines = logDelta.length;
  const run = pushQueue.then(() => send(payload, sentLines));
  pushQueue = run.then(() => undefined, () => undefined);
  return run;
}

let pushQueue: Promise<void> = Promise.resolve();

async function send(payload: string, sentLines: number): Promise<PushOutcome> {
  const { code, version } = getOnline();
  if (code === undefined) return 'offline';
  updateOnline({ sync: 'pushing', error: undefined });

  for (let attempt = 0; ; attempt++) {
    const res = await pushState(code, payload, version ?? 0);

    if (res.ok) {
      // Only what this payload carried: lines from the next turn may have
      // arrived while the request was in flight, and are still owed.
      logDelta = logDelta.slice(sentLines);
      updateOnline({ version: res.data.version, sync: 'waiting', error: undefined });
      return 'sent';
    }

    if (res.kind === 'stale') {
      // Someone else's write landed first. There is no merge -- our turn was
      // played against a board that has since moved on.
      updateOnline({ sync: 'error', error: 'stale', version: res.version });
      return 'stale';
    }

    // A missing game is permanent -- retrying cannot bring it back.
    if (res.kind === 'notfound') {
      updateOnline({ sync: 'error', error: 'notfound' });
      return 'failed';
    }

    if (attempt >= RETRY_DELAYS_MS.length) {
      updateOnline({
        sync: 'error',
        error: res.kind === 'network' ? res.message : `HTTP ${res.status ?? '?'}`,
      });
      return 'failed';
    }

    await wait(RETRY_DELAYS_MS[attempt]);
  }
}
