export function rollDice(): number {
  const newValue = Math.floor(Math.random() * 6) + 1;

  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('diceRolled', { detail: newValue }));
  }

  return newValue;
}
