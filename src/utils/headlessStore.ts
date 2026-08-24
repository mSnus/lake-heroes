/**
 * Marks a headless economy simulation as running -- an AI-only game played
 * out against its own throwaway GameState, with nothing meant to be visible
 * in the real, currently-mounted app. Every place that would otherwise
 * touch the shared screen/event machinery (gameEvent, say's log event,
 * showScreen and friends) checks this first and takes a silent path
 * instead, so a background sim can't pop the real dice modal, clobber the
 * real screen, or spam the real game log.
 */
let headless = false;

export function setHeadlessRun(on: boolean): void {
  headless = on;
}

export function isHeadlessRun(): boolean {
  return headless;
}
