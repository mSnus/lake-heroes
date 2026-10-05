import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
import { syndicateMultiplier } from '../game/syndicate';
import { setGameMessage } from '../utils/gameMessage';
import { VISIT_GOLD_MULT, VISIT_UNITS_SHARE } from '../game/constants';
import { t } from '../i18n';
export function handleVisitOwnTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  const tile = board.activeTile;
  const player = board.activePlayer;

  console.log('Action: visit own tile', player, tile);

  if (tile.isYielded) {
    setGameMessage(board, t('visitOwnTile.yourTileYielded', { tileName: tile.name }));
    updateGameState(board);
    setEndTurn();
    return;
  }

  const mult = syndicateMultiplier(board, player, tile.group);
  const syndicateTag = mult > 1 ? ' (💰×2)' : '';

  const rewards = [];
  if (tile.bonusType === 'gold') {
    const goldReward = Math.round((tile.bonuses[tile.level] || 0) * mult * VISIT_GOLD_MULT);
    rewards.push(`${goldReward}🟡`);
    player.gold += goldReward;
  }

  if (tile.bonusType === 'units') {
    const unitsReward = Math.round((tile.bonuses[tile.level] || 0) * mult * VISIT_UNITS_SHARE);
    rewards.push(`${unitsReward}🧍`);
    player.units += unitsReward;
  }

  const rewardsStr = rewards.join(` ${t('common.and')} `);
  say(t('visitOwnTile.provides', { tileName: tile.name, playerName: player.name, rewards: rewardsStr, syndicateTag }), 'info');

  updateGameState(board);
  setEndTurn();
}
