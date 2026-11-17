import { Player } from '../game/Player';
import { KARMA_CURSED, KARMA_BLESSED } from '../game/constants';

export const isCursed = (player: Player): boolean => (player.karma ?? 0) <= KARMA_CURSED;
export const isBlessed = (player: Player): boolean => (player.karma ?? 0) >= KARMA_BLESSED;

/**
 * Adjust a player's karma -- deliberately silent (no say/log/toast). Karma
 * is a clandestine mechanic: it must never announce itself, only quietly
 * bias odds elsewhere (see game/constants.ts's KARMA_* knobs).
 */
export function changeKarma(player: Player, delta: number, cap?: number): void {
  const next = (player.karma ?? 0) + delta;
  player.karma = cap !== undefined ? Math.min(next, cap) : next;
}

/** 🕷️ when cursed (negative), 🕊️ below 3, 🌈 from 3 up. */
export function karmaEmoji(karma: number): string {
  return karma < 0 ? '🕷️' : karma < 3 ? '🕊️' : '🌈';
}
