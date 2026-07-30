import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';

export function handleTavern(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: tavern');

  const player = board.activePlayer;
  const circles = player.circles ?? 0;
  const circleMultiplier = circles >= 12 ? 2 : circles >= 6 ? 1.5 : 1;
  const unitsReward = Math.round(roll * circleMultiplier);
  const gained = player.gainMilitia(unitsReward);
  const turnedAway = unitsReward - gained;

  updateGameState(board);

  const joinedMsg =
    gained > 0
      ? `${gained}🧍 joined the mighty army<br />of <span style="color:${player.color}">${player.name}</span>`
      : `No one joined — <span style="color:${player.color}">${player.name}</span>'s army has no room left`;
  const fullNote =
    turnedAway > 0
      ? `<br /><span style="font-size:0.8em">(🏯 ${player.slotsUsed}/${player.armySlots} army slots full — ${turnedAway}🧍 turned away)</span>`
      : '';

  showScreen({
    screenType: 'tavern-result',
    background: 'assets/screens/tavern.jpg',
    htmlMessage: `${joinedMsg}${fullNote}`,
    buttons: [
      {
        label: 'New folks are always welcome!',
        action: 'end-turn',
        onClick: () => {
          clearScreen();
          setEndTurn();
        },
      },
    ],
  });
}
