import { toast, ToastContent } from 'react-toastify';
import { gameEvent } from './events';

export type SayLevel = 'default' | 'info' | 'success' | 'warning' | 'error';

/**
 * say: unified user notification helper.
 * - Shows a react-toastify toast
 * - Logs the same message to the console with an appropriate severity
 * - Dispatches a 'logMessage' event for history tracking
 */
export function say(message: ToastContent, level: SayLevel = 'info'): void {
  // Show toast by level
  switch (level) {
    case 'success':
      // toast.success(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'info':
      // toast.info(message);
      break;
    case 'default':
    default:
      // toast(message);
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

  // Dispatch event for history
  if (typeof message === 'string') {
    gameEvent('logMessage', { message, level, timestamp: Date.now() });
  }
}
