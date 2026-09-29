import { GameState } from './GameState';
import { Player } from './Player';

/**
 * Who this browser is allowed to act for.
 *
 * Offline every predicate here answers "yes" — one device drives every seat,
 * which is what the whole codebase assumed before online play existed. That is
 * the safety property: with no online game active, every call site below
 * behaves exactly as its old `!player.isComputer` check did.
 *
 * Online, a seat is identified by its index in `GameState.players`, which the
 * server hands back as `playerIndex` when a join code is redeemed. Note this is
 * NOT `activePlayerIndex`: that indexes `playerOrder`, a shuffled array (see
 * GameState.activePlayer), so "whose turn is it" has to go through the
 * indirection rather than comparing indices directly.
 */

/** Set by the online layer once a game is joined; null when playing offline. */
let session: { seats: number[]; isHost: boolean } | null = null;

export function setSeatSession(next: { seats: number[]; isHost: boolean } | null): void {
  session = next;
}

export function isOnline(): boolean {
  return session !== null;
}

/** Every seat this browser plays. More than one is a hot-seat bundle: several
 * players sharing a single device, each still a distinct seat on the server. */
export function mySeats(): number[] {
  return session?.seats ?? [];
}

function isMySeat(seat: number): boolean {
  return !!session && session.seats.includes(seat);
}

export function isHost(): boolean {
  return session?.isHost ?? false;
}

/**
 * A player's seat index, derived from the 1-based id assigned by array order
 * (see rehydrate.ts). Synthetic NPC opponents — the rogue horde, sim fixtures —
 * are constructed with id 0 and hold no seat, so they return -1.
 */
export function seatIndex(player: Player): number {
  return (player.id ?? 0) - 1;
}

/** Is the seat currently on turn the one this browser holds? */
export function isLocalTurn(board: GameState): boolean {
  if (!isOnline()) return true;
  return isMySeat(board.playerOrder[board.activePlayerIndex]);
}

/**
 * Should this browser run this player's turn? True for my own seat, and for bot
 * seats if I am the host (bots need exactly one client to drive them, or they
 * would act once per connected player).
 *
 * A synthetic player with no seat is driven by whoever owns the current turn —
 * it only exists inside an encounter belonging to that turn.
 */
export function isLocallyDriven(player: Player, board: GameState): boolean {
  if (!isOnline()) return true;
  const seat = seatIndex(player);
  if (seat < 0) return isLocalTurn(board);
  return isMySeat(seat) || (isHost() && player.isComputer);
}

/**
 * Should this browser offer a human interface for this player? Narrower than
 * isLocallyDriven: a bot the host drives is locally driven but never prompts.
 *
 * This is the replacement for a bare `!player.isComputer` at every UI gate.
 */
export function isLocalHuman(player: Player): boolean {
  if (player.isComputer) return false;
  if (!isOnline()) return true;
  return isMySeat(seatIndex(player));
}
