/**
 * A single "stop everything" flag for the current game session.
 *
 * Turn logic runs as async loops and queued timers that hold a captured board
 * (see rollAndMove's step loop, BotController's scheduled actions). Starting a
 * new game replaces the GameState, but those already-running loops keep going
 * and push the *old* board back into React state -- which is how a new game
 * could come back as the previous one, bots still playing.
 *
 * Anything long-running checks isHalted() and bails out.
 */
let halted = false;

/** Stop every in-flight game loop. Call before tearing a game down. */
export function halt(): void {
  halted = true;
}

/** Clear the flag for a freshly started game. */
export function resumeAfterHalt(): void {
  halted = false;
}

export function isHalted(): boolean {
  return halted;
}
