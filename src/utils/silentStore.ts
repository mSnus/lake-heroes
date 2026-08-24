/**
 * Suppresses background UI side-effects that would otherwise leak out of a
 * screenless run -- currently just say()'s game-log event (see say.ts). The
 * headless economy simulator plays out many turns against its own throwaway
 * GameState; without this, every one of those turns' say() calls would still
 * spam the real, on-screen Game Log even though nothing is meant to be
 * visible.
 */
let silent = false;

export function setSilentMode(on: boolean): void {
  silent = on;
}

export function isSilentMode(): boolean {
  return silent;
}
