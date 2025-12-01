export class Dice {
  // new: visibility flag belongs to Dice instance
  visible: boolean = false;

  roll(): number {
    const result = Math.floor(Math.random() * 6) + 1;
    // emit a global event so UI can show the dice
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('diceRolled', { detail: result }));
    }
    return result;
  }
}
