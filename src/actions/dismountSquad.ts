import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { Player } from '../game/Player';
import { Cost, upgradeCost, scaleCost, refund, formatCost } from '../game/resources';
import { t } from '../i18n';

/** Refunded for dismounting `count` riders into militia — the reverse of
 * upgradeSquadCost: the rider's horse is sold off, leaving a foot soldier,
 * so the player gets back the difference between the two recipes. */
export function dismountRefund(count: number): Cost {
  return scaleCost(upgradeCost(), count);
}

/** Most riders that can dismount -- limited by the militia cap. */
export function maxDismount(player: Player): number {
  return Math.min(player.riders, player.armyRoom('militia'));
}

/**
 * Converts `count` riders back into the same number of militia, refunding
 * dismountRefund(count). One-way by design — the Garrisons screen
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

  const returned = dismountRefund(dismounted);
  player.riders -= dismounted;
  player.militia += dismounted;
  refund(player, returned);

  say(t('dismountSquad.dismounted', { playerName: player.name, amount: dismounted, cost: formatCost(returned) }), 'info');
  updateGameState(board);
}
