import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { getOverrides } from '../utils/overridesStore';
import { computeSlotsUsed } from '../game/army';
import { t } from '../i18n';

/** Gold refunded for dismounting `count` riders into militia — the reverse
 * of upgradeSquadCost: the rider's horse is sold off, leaving a foot
 * soldier, so the player gets back the price difference between the tiers. */
export function dismountRefund(count: number): number {
  const ov = getOverrides();
  return Math.max(0, count * (ov.riderPrice - ov.militiaPrice));
}

/**
 * Every dismount count that leaves the army inside its slot limit, ascending
 * (always includes 0).
 *
 * A dismount keeps headcount identical but re-splits it across the tiers,
 * and the split is what costs slots: at capacity 12, 10🧍+10🐎 is 2 slots,
 * but 15🧍+5🐎 is 3. So the legal counts are NOT a contiguous range — for
 * that army they are {0,1,2,10}, with 3..9 all overflowing. Dismounting
 * *everything* is always legal (one tier can never need more ceil-slots than
 * the same headcount split across two), which is why the gap sits in the
 * middle rather than at the top.
 */
export function legalDismounts(militia: number, riders: number, slots: number): number[] {
  const legal: number[] = [];
  for (let d = 0; d <= riders; d++) {
    if (computeSlotsUsed(militia + d, riders - d) <= slots) legal.push(d);
  }

  return legal;
}

/** The legal dismount count nearest to `wanted` — what the slider actually
 * commits, so dragging across the illegal middle snaps to an edge of the gap
 * instead of building an army that overflows its slots. */
export function snapDismount(militia: number, riders: number, slots: number, wanted: number): number {
  const legal = legalDismounts(militia, riders, slots);
  return legal.reduce((best, d) => (Math.abs(d - wanted) < Math.abs(best - wanted) ? d : best), 0);
}

/**
 * Converts `count` riders back into the same number of militia, refunding
 * dismountRefund(count) gold. One-way by design — the Garrisons screen
 * offers this so a rider-heavy army can free up foot soldiers to garrison
 * tiles, but never the reverse (buying riders belongs to the Tavern and the
 * King's Castle, not here).
 */
export function dismountSquad(
  board: GameState | null,
  count: number,
  updateGameState: (board: GameState) => void
) {
  if (!board || count <= 0) return;

  const player = board.activePlayer;
  const dismounted = snapDismount(player.militia, player.riders, player.armySlots, count);
  if (dismounted <= 0) return;

  const refund = dismountRefund(dismounted);
  player.riders -= dismounted;
  player.militia += dismounted;
  player.gold += refund;

  say(t('dismountSquad.dismounted', { playerName: player.name, amount: dismounted, gold: refund }), 'info');
  updateGameState(board);
}
