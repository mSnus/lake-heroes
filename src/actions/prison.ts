import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function handlePrison(
  board: GameState | null,
  setGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  console.log('Action: prison');

  const player = board.activePlayer;
  player.turnsToSkip = 1;
  setGameState(Object.setPrototypeOf({ ...board }, GameState.prototype));
  say(`${player.name} landed on Prison! Next turn will be skipped.`, 'warning');
  setMenu({ type: 'move-result', diceRoll: 0, passedStart: false });
}
