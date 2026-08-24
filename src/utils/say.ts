import { toast, ToastContent } from 'react-toastify';
import { gameEvent } from './events';
import { getOverrides } from './overridesStore';
import { isHeadlessRun } from './headlessStore';
import { recordSimLog } from './simLogStore';

export type SayLevel = 'default' | 'info' | 'success' | 'warning' | 'error' | 'debug';

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

  // Show toast by level. The mute override suppresses only the pop-up — the
  // console mirror and game-log event below still fire, so nothing is lost.
  const muted = getOverrides().muteToasts;
  switch (level) {
    case 'success':
      if (!muted) toast.success(message);
      break;
    case 'warning':
      if (!muted) toast.warning(message);
      break;
    case 'error':
      if (!muted) toast.error(message);
      break;
    case 'info':
      if (!muted) toast.info(message);
      console.info(message);
      break;
    case 'debug':
      console.log(message);
      break;
    case 'default':
    default:
      if (!muted) toast(message);
      break;
  }

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
