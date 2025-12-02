import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

export function handleKingCastle(
  board: GameState | null,
  setGameState: (board: GameState) => void,
  endTurn: () => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle');

  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;
  setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));
  say(`King provides ${player.name} with ${unitsReward}🧍!`, 'success');
  endTurn();
}
