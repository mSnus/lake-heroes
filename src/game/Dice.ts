import { gameEvent } from '../utils/events';

export function rollDice(): number {
  const newValue = Math.floor(Math.random() * 6) + 1;

  gameEvent('diceRolled', newValue);
  setTimeout(() => {
    gameEvent('hideDice');
  }, 1000);

  return newValue;
}
