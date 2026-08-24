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

const key = (playerId: number, circle: number) => `${playerId}:${circle}`;

export function setSimLogBoard(next: SimLogBoard | null): void {
  board = next;
}

export function resetSimLog(): void {
  entries = new Map();
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
