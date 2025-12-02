import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

export function handleRogueCamp(
  board: GameState | null,
  setGameState: (board: GameState) => void,
  endTurn: () => void
) {
  if (!board) return;
  console.log('Action: tavern');

  const dice = new Dice();
  const roll = dice.roll();
  const unitsReward = roll;
  const player = board.activePlayer;
  player.units += unitsReward;
  setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));
  say(`${player.name} recruited units! Rolled ${roll}, received ${unitsReward} U!`, 'success');
  endTurn();
}
