import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

export function handleTreasureBox(
  board: GameState | null,
  setGameState: (board: GameState) => void,
  endTurn: () => void
) {
  if (!board) return;
  console.log('Action: treasure box');

  const dice = new Dice();
  const roll = dice.roll();
  
  const goldReward = roll * 100;
  const player = board.activePlayer;
  
  player.gold += goldReward;
  
  setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));
  say(`${player.name} found treasure! Rolled ${roll}, received ${goldReward} GP!`, 'success');
  
  endTurn();
}
