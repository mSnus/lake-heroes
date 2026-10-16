import { GameState } from '../game/GameState';
import { LogMessage } from '../components/menu/GameLogModal';
import { isLocallyDriven } from '../game/seats';
import { postEvents, OutboundEvent } from './api';
import { getOnline } from './onlineStore';

/**
 * Streams the acting player's narration to everyone else while the turn is
 * still running, instead of making them wait for the state handed over at the
 * end.
 *
 * Listens to the same `logMessage` event `say()` already emits — so no call
 * site has to opt in — and to `bannerMessage` from setGameMessage. Anything
 * that should stay on one screen goes through `sayLocal()`, which emits a
 * different event this never hears (see utils/say.ts).
 */

/** Coalescing window. The first line of a burst goes immediately; anything
 * that follows within this window rides along on one request. */
const COOLDOWN_MS = 1000;

/** Matches the server's per-request cap (GameController::appendEvents). */
const MAX_BATCH = 20;

let pending: OutboundEvent[] = [];
let lastSentAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The turn this client is currently narrating, or null between turns. Set by
 * beginTurn and cleared by endTurn, so nothing outside a live turn is ever
 * broadcast — which also catches app-lifecycle messages for free. */
let openBoard: GameState | null = null;

/** Highest seq the server has accepted from us. Travels in the turn envelope
 * so the receiver knows which _log lines the stream already delivered. */
let sentThrough = 0;

export function eventsSentThrough(): number {
  return sentThrough;
}

function queue(event: OutboundEvent): void {
  const board = openBoard;
  if (!board) return;
  if (getOnline().code === undefined) return;
  // Exactly one client narrates: the seat's owner, or the host for a bot.
  // Not isLocalTurn -- that is false on the host while a bot plays, which is
  // precisely when the other players have nothing else to look at.
  if (!isLocallyDriven(board.activePlayer, board)) return;

  pending = [...pending, event].slice(-MAX_BATCH);
  schedule();
}

function schedule(): void {
  if (timer) return;
  const wait = Math.max(0, COOLDOWN_MS - (Date.now() - lastSentAt));
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, wait);
}

async function flush(): Promise<void> {
  const { code } = getOnline();
  const batch = pending;
  if (!code || batch.length === 0) return;

  pending = [];
  lastSentAt = Date.now();

  const res = await postEvents(code, batch);
  if (res.ok) {
    sentThrough = res.data.lastEvent;
  } else {
    // Narration is cosmetic. Never retry and never touch onlineStore.sync:
    // OnlineWaitShield renders "connection lost" off that flag, so a dropped
    // toast would put an alarming banner on every observer's screen. Put the
    // lines back and let the next flush try again; if the turn ends first they
    // still travel in the envelope's _log.
    pending = [...batch, ...pending].slice(-MAX_BATCH);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('logMessage', (e: Event) => {
    const d = (e as CustomEvent).detail as LogMessage;
    // 'debug' is per-roll chatter and never toasts anywhere, so there is no
    // point paying to ship it.
    if (d?.message && d.level !== 'debug') {
      queue({ kind: 'toast', level: d.level, message: d.message });
    }
  });

  // narrate(): broadcast-only lines, for the stretches the acting player
  // watches happen but everyone else would otherwise see as a frozen board.
  window.addEventListener('narrate', (e: Event) => {
    const d = (e as CustomEvent).detail as { message: string; level: string };
    if (d?.message) queue({ kind: 'toast', level: d.level, message: d.message });
  });

  // narrateMove(): one hop of the acting player's token, piggybacked on the
  // same toast schema under a level no real toast uses -- see
  // useOnlineSync's renderEvents, which pulls 'move'-level events back out
  // before they ever reach showToast.
  window.addEventListener('narrateMove', (e: Event) => {
    const d = (e as CustomEvent).detail as { position: number };
    if (d && Number.isFinite(d.position)) {
      queue({ kind: 'toast', level: 'move', message: String(d.position) });
    }
  });

  window.addEventListener('bannerMessage', (e: Event) => {
    const message = (e as CustomEvent).detail as string;
    if (message) queue({ kind: 'banner', level: 'info', message });
  });
}

/** Begin narrating this turn. */
export function openStream(board: GameState): void {
  openBoard = board;
}

/** Stop narrating and hand back anything still unsent, so endTurn can fold it
 * into the state push rather than racing a final request against it. */
export function closeStream(): OutboundEvent[] {
  openBoard = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  const tail = pending;
  pending = [];
  return tail;
}
