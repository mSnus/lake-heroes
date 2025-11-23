import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { say } from '../utils/say';

export function handlePrison(
  board: Board | null,
  setBoard: (board: Board) => void,
  setMenu: (menu: MenuState) => void
) {
  if (!board) return;
  const player = board.activePlayer;
  player.turnsToSkip = 1;
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));
  say(`${player.name} landed on Prison! Next turn will be skipped.`, 'warning');
  setMenu({ type: 'move-result', diceRoll: 0, passedStart: false });
}

