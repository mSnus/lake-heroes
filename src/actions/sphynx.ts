import { Board } from '../game/Board';
import { Dice } from '../game/Dice';
import { say } from '../utils/say';

/**
 * Handle landing on Sphynx tile.
 * Rules per spec:
 * - Roll 1–2: lose half of current gold, rounded UP to the nearest 50 (cap at current gold).
 * - Roll 3–4: lose 20% of current units, rounded UP to 1 (cap at current units).
 * - Roll 5: nothing happens.
 * - Roll 6: gain 20% of current gold, rounded UP to the nearest 100.
 * After applying effect, end the turn.
 */
export function handleSphynx(
  board: Board | null,
  setBoard: (board: Board) => void,
  endTurn: () => void
) {
  if (!board) return;
  const dice = new Dice();
  const roll = dice.roll();

  const player = board.activePlayer;
  let message = `${player.name} met the Sphynx and rolled ${roll}. `;

  if (roll === 1 || roll === 2) {
    // Lose half gold, rounded up to nearest 50, capped by available gold
    const half = player.gold / 2;
    const roundedUp50 = Math.ceil(half / 50) * 50;
    const loss = Math.min(player.gold, roundedUp50);
    player.gold -= loss;
    message += `Lost ${loss} GP (half, rounded up to 50).`;
  } else if (roll === 3 || roll === 4) {
    // Lose 20% units, rounded up to at least 1, but not below zero
    const raw = Math.ceil(player.units * 0.2);
    const atLeastOne = player.units > 0 ? Math.max(1, raw) : 0;
    const loss = Math.min(player.units, atLeastOne);
    player.units -= loss;
    message += `Lost ${loss} U (20% rounded up to 1).`;
  } else if (roll === 5) {
    // Nothing happens
    message += `Nothing happens.`;
  } else if (roll === 6) {
    // Gain 20% gold, rounded up to nearest 100
    const bonusBase = player.gold * 0.2;
    const gain = Math.ceil(bonusBase / 100) * 100;
    player.gold += gain;
    message += `Received ${gain} GP (20% rounded up to 100).`;
  }

  // Persist state
  setBoard(Object.setPrototypeOf({ ...board }, Board.prototype));

  // Announce
  say(message, roll === 6 ? 'success' : roll === 5 ? 'info' : 'warning');

  // End turn
  endTurn();
}
