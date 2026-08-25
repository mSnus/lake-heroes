/**
 * Per-player, per-circle message log for a headless economy simulation.
 *
 * A sim plays thousands of turns against a throwaway GameState, so say()'s
 * toasts would flood the real, still-mounted app. Instead say() routes its
 * messages here (see say.ts) and the results table shows them grouped by
 * the circle they happened in.
 *
 * Attribution is live rather than pushed: the store holds the board, and
 * reads whoever is the active player -- and whichever circle they're on --
 * at the moment the message fires. That keeps messages with the right
 * player even when the turn changes hands mid-sequence (endTurn advances
 * the active player, then collects income and reports it for the new one).
 */
interface SimLogBoard {
  activePlayer: { id: number; name: string; circles: number };
}

let board: SimLogBoard | null = null;
let entries = new Map<string, string[]>();
let income = new Map<string, { gold: number; units: number }>();
let tileVisits = new Map<string, string[]>();
let circleSnapshots = new Map<string, string>();

const key = (playerId: number, circle: number) => `${playerId}:${circle}`;

export function setSimLogBoard(next: SimLogBoard | null): void {
  board = next;
}

export function resetSimLog(): void {
  entries = new Map();
  income = new Map();
  tileVisits = new Map();
  circleSnapshots = new Map();
}

/**
 * Strips markup and the speaker's own name -- the cell already says who this
 * is, so "⚔️ blue wins a battle with red" reads better as "⚔️ wins a battle
 * with red". Only a leading name is dropped (optionally behind an emoji, as
 * most battle messages are); a name appearing mid-sentence is left alone,
 * since there it's usually the OTHER player ("red is now of fame 4") or
 * load-bearing grammar ("The King sees red falling behind").
 */
function tidy(message: string, name: string): string {
  const text = message
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^([^\\w]*)${escaped}\\s+`), '$1').trim();
}

export function recordSimLog(message: string): void {
  if (!board) return;
  const player = board.activePlayer;
  if (!player) return;

  const text = tidy(message, player.name);
  if (!text) return;

  const k = key(player.id, player.circles);
  const list = entries.get(k);
  if (list) list.push(text);
  else entries.set(k, [text]);
}

export function getSimLog(playerId: number, circle: number): string[] {
  return entries.get(key(playerId, circle)) ?? [];
}

/** Tile income is collected every turn, not toasted per-turn like other
 * events -- accumulated per circle instead of logged line by line, so a
 * player who owns tiles for a whole lap gets one running total rather than
 * a repeat of "collects Ngold" once per turn (see endTurn.ts). */
export function recordSimIncome(gold: number, units: number): void {
  if (!board || (gold <= 0 && units <= 0)) return;
  const player = board.activePlayer;
  if (!player) return;

  const k = key(player.id, player.circles);
  const existing = income.get(k);
  if (existing) {
    existing.gold += gold;
    existing.units += units;
  } else {
    income.set(k, { gold, units });
  }
}

export function getSimIncome(playerId: number, circle: number): { gold: number; units: number } {
  return income.get(key(playerId, circle)) ?? { gold: 0, units: 0 };
}

/** One tile stepped onto during a move, in order -- read live off
 * board.activePlayer.circles at call time, same as recordSimLog/
 * recordSimIncome, so a step that crosses King's Castle (which bumps
 * circles before this fires, see rollAndMove.ts) automatically lands in the
 * NEXT circle's sequence rather than the one the move started in. */
export function recordSimTileVisit(tileName: string): void {
  if (!board) return;
  const player = board.activePlayer;
  if (!player) return;

  const k = key(player.id, player.circles);
  const list = tileVisits.get(k);
  if (list) list.push(tileName);
  else tileVisits.set(k, [tileName]);
}

export function getSimTileVisits(playerId: number, circle: number): string[] {
  return tileVisits.get(key(playerId, circle)) ?? [];
}

/**
 * A player's stat line (see formatPlayerCell) captured the instant they
 * cross King's Castle -- i.e. player.circles has JUST become `circle` (see
 * passStart.ts). That single moment doubles as both "circle `circle`
 * begins" AND "circle `circle - 1` ends", so the results table derives both
 * from this one map (getSimCircleSnapshot(id, N) for the begin of row N,
 * getSimCircleSnapshot(id, N + 1) for its end) instead of keeping two.
 */
export function recordSimCircleSnapshot(playerId: number, circle: number, cell: string): void {
  circleSnapshots.set(key(playerId, circle), cell);
}

export function getSimCircleSnapshot(playerId: number, circle: number): string | null {
  return circleSnapshots.get(key(playerId, circle)) ?? null;
}
