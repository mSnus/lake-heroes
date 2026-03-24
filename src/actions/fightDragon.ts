import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { say } from '../utils/say';
import { showDice } from '../utils/diceStore';

export const DRAGON_UNITS_THRESHOLD = 50;

export function fightDragon(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
) {
  if (!board) return;

  const player = board.activePlayer;
  const roll = rollDice();

  say(`${player.name} challenges the Dragon and rolls ${roll}!`, 'info');

  if (roll >= 4) {
    board.gameMessage = `${player.name} slays the Dragon! 🐉 VICTORY!`;
    board.gameOver = true;
    say(`${player.name} slays the Dragon and wins the game! 🎉`, 'success');
    updateGameState(board);
  } else {
    const unitLoss = Math.ceil(player.units / 2);
    const goldLoss = player.gold;
    player.units -= unitLoss;
    player.gold = 0;

    say(
      `${player.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍.`,
      'error'
    );
    board.gameMessage = `Defeated by the Dragon! Lost all gold and ${unitLoss}🧍`;
    updateGameState(board);

    showDice();
  }
}
