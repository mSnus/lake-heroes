import { isHeadlessRun } from './headlessStore';

export function gameEvent(event: string, detail: any = null) {
  if (!['logMessage', 'logMessageLocal', 'bannerMessage', 'narrate', 'narrateMove'].includes(event)) {
    console.debug(`✉️ received ${event}`, detail);
  }

  // A headless simulation runs its own throwaway GameState while the real
  // app stays mounted -- dispatching for real here would make the real
  // app's listeners (dice modal, active tile card, turn phase) react to a
  // game the user never asked to see.
  if (isHeadlessRun()) return;

  window.dispatchEvent(new CustomEvent(event, { detail: detail }));
}
