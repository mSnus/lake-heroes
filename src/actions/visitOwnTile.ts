import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { setEndTurn } from '../utils/endTurnStore';
export function handleVisitOwnTile(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  if (board.circles === 0) return;

  const tile = board.activeTile;
  const player = board.activePlayer;

  console.log('Action: visit own tile', player, tile);

  let rewards = [];
  if (tile.bonusType === 'gold') {
    const goldReward = tile.bonuses[tile.level] || 0;
    rewards.push(`${goldReward}🟡`);

    player.gold += goldReward;
  }

  if (tile.bonusType === 'units') {
    const unitsReward = tile.bonuses[tile.level] || 0;
    rewards.push(`${unitsReward}🧍`);

    player.units += unitsReward;
  }

  const rewardsStr = rewards.join(' and ');
  say(`${tile.name} provides ${player.name} with ${rewardsStr}!`, 'debug');
  board.gameMessage = `Your ${tile.name} provides you with ${rewardsStr}!`;

  updateGameState(board);
  setEndTurn();
}
