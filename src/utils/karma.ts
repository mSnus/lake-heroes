import { Player } from '../game/Player';

/**
 * Adjust a player's karma -- deliberately silent (no say/log/toast). Karma
 * is a clandestine mechanic: it must never announce itself, only quietly
 * bias odds elsewhere (see game/constants.ts's KARMA_* knobs).
 */
export function changeKarma(player: Player, delta: number): void {
  player.karma = (player.karma ?? 0) + delta;
}
