import { toast, ToastContent } from 'react-toastify';
import { gameEvent } from './events';
import { getOverrides } from './overridesStore';
import { isHeadlessRun } from './headlessStore';
import { recordSimLog } from './simLogStore';

export type SayLevel = 'default' | 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Pop a toast, without touching the console mirror or the game-log history.
 *
 * Split out of say() so a turn's messages can be replayed on the OTHER
 * players' screens (see online/useOnlineSync): those arrive with their history
 * already attached, so re-running the logging half would duplicate every line.
 *
 * 'debug' deliberately never toasts — it is per-roll chatter.
 */
export function showToast(message: ToastContent, level: SayLevel = 'info'): void {
  // The mute override suppresses only the pop-up; say()'s console mirror and
  // game-log event still fire, so nothing is lost.
  if (getOverrides().muteToasts) return;
  switch (level) {
    case 'success':
      toast.success(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'info':
      toast.info(message);
      break;
    case 'debug':
      break;
    case 'default':
    default:
      toast(message);
      break;
  }
}

/**
 * say: unified user notification helper.
 * - Shows a react-toastify toast (unless toasts are muted via the ⚖️ overrides)
 * - Logs the same message to the console with an appropriate severity
 * - Dispatches a 'logMessage' event for history tracking
 */
export function say(message: ToastContent, level: SayLevel = 'info'): void {
  // A headless sim plays thousands of turns against its own board -- toasting
  // (or console-mirroring) all of that would flood the real app and slow the
  // run down. Collect the meaningful messages into the per-circle sim log for
  // the results table instead; 'debug' is per-roll chatter, so it's dropped.
  if (isHeadlessRun()) {
    if (level !== 'debug' && typeof message === 'string') recordSimLog(message);
    return;
  }

  showToast(message, level);

  // Console mirror
  const text = typeof message === 'string' ? message : '[toast message]';
  switch (level) {
    case 'warning':
      console.warn(`[toast:${level}] ${text}`);
      break;
    case 'error':
      console.error(`[toast:${level}] ${text}`);
      break;
    case 'success':
      console.log(`[toast:${level}] ${text}`);
      break;
    case 'info':
      console.info(`[toast:${level}] ${text}`);
      break;
    case 'default':
    default:
      console.log(`[toast:${level}] ${text}`);
      break;
  }

  // Dispatch event for history. A headless run never reaches this far.
  if (typeof message === 'string') {
    gameEvent('logMessage', { message, level, timestamp: Date.now() });
  }
}

/**
 * say() for something only THIS player should see: a tooltip they clicked, a
 * validation error they hit, a connection problem on their own machine.
 *
 * Identical to say() locally — same toast, same console, same game log — but
 * dispatched under a different event name, so the online streamer (which
 * listens for 'logMessage' and broadcasts what it hears) never picks it up.
 *
 * A separate event rather than a `broadcast: false` field on the payload:
 * LogMessage is persisted to localStorage and shipped inside the turn
 * envelope, so a flag would leak into both. This way "what gets broadcast" is
 * answerable with a grep.
 */
export function sayLocal(message: ToastContent, level: SayLevel = 'info'): void {
  if (isHeadlessRun()) return;
  showToast(message, level);
  if (typeof message === 'string') {
    gameEvent('logMessageLocal', { message, level, timestamp: Date.now() });
  }
}
