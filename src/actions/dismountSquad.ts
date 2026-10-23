import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { getOverrides } from '../utils/overridesStore';
import { Player } from '../game/Player';
import { t } from '../i18n';

/** Gold refunded for dismounting `count` riders into militia — the reverse
 * of upgradeSquadCost: the rider's horse is sold off, leaving a foot
 * soldier, so the player gets back the price difference between the tiers. */
export function dismountRefund(count: number): number {
  const ov = getOverrides();
  return Math.max(0, count * (ov.riderPrice - ov.militiaPrice));
}

/** Most riders that can dismount -- limited by the militia cap. */
export function maxDismount(player: Player): number {
  return Math.min(player.riders, player.armyRoom('militia'));
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
  const dismounted = Math.min(count, maxDismount(player));
  if (dismounted <= 0) return;

  const refund = dismountRefund(dismounted);
  player.riders -= dismounted;
  player.militia += dismounted;
  player.gold += refund;

  say(t('dismountSquad.dismounted', { playerName: player.name, amount: dismounted, gold: refund }), 'info');
  updateGameState(board);
}
