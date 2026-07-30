import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { syndicateMultiplier } from '../game/syndicate';
import { t } from '../i18n';
export function handleVisitOwnTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  if ((board.activePlayer.circles ?? 0) === 0) return;

  const tile = board.activeTile;
  const player = board.activePlayer;

  console.log('Action: visit own tile', player, tile);

  const mult = syndicateMultiplier(board, player, tile.group);
  const syndicateTag = mult > 1 ? ' (💰×2)' : '';

  const rewards = [];
  if (tile.bonusType === 'gold') {
    const goldReward = (tile.bonuses[tile.level] || 0) * mult;
    rewards.push(`${goldReward}🟡`);
    player.gold += goldReward;
  }

  if (tile.bonusType === 'units') {
    const unitsReward = (tile.bonuses[tile.level] || 0) * mult;
    rewards.push(`${unitsReward}🧍`);
    player.units += unitsReward;
  }

  const rewardsStr = rewards.join(` ${t('common.and')} `);
  say(t('visitOwnTile.provides', { tileName: tile.name, playerName: player.name, rewards: rewardsStr, syndicateTag }), 'debug');
  board.gameMessage = t('visitOwnTile.yourTileProvides', { tileName: tile.name, rewards: rewardsStr, syndicateTag });

  updateGameState(board);
  setEndTurn();
}
