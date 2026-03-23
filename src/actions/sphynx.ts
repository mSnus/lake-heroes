import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { MenuState } from '../types/menuState';

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
  gameState: GameState | null,
  updateGameState: (board: GameState) => void,
  setMenu: (menu: MenuState) => void,
  roll: number
) {
  if (!gameState) return;

  const player = gameState.activePlayer;
  let message = `${player.name} met the Sphynx and rolled ${roll}. `;

  if (roll === 1 || roll === 2) {
    // Lose half gold, rounded up to nearest 50, capped by available gold
    if (player.gold > 0) {
      const half = player.gold / 2;
      const roundedUp50 = Math.ceil(half / 50) * 50;
      const loss = Math.min(player.gold, roundedUp50);

      player.gold -= loss;
      message += `Lost half of gold: -${loss}🟡`;
      gameState.gameMessage = `You escape the Sphynx losing ${loss}🟡`;
    } else {
      message += `He sees your poverty and lets you go.`;
      gameState.gameMessage = `The Sphinx refuses to deal with beggars`;
    }
  } else if (roll === 3 || roll === 4) {
    // Lose 30% units, rounded up to at least 1, but not below zero
    const raw = Math.ceil(player.units * 0.33);
    const atLeastOne = player.units > 0 ? Math.max(1, raw) : 0;
    const loss = Math.min(player.units, atLeastOne);

    player.units -= loss;
    message += `Lost ${loss}🧍 (1/3).`;
    gameState.gameMessage = `Sphynx eats ${loss}🧍, but you escape.`;
  } else if (roll === 5) {
    message += `Nothing happens.`;
    gameState.gameMessage = `Sphynx remained silent. Nothing happened.`;
  } else if (roll === 6) {
    // Gain 20% gold, rounded up to nearest 100
    const bonusBase = player.gold * 0.2;
    const gain = Math.ceil(bonusBase / 100) * 100;
    player.gold += gain;
    message += `Received ${gain}🟡 (20%).`;
    gameState.gameMessage = `Sphynx rewarded you with ${gain}🟡 for your wisdom!`;
  }

  updateGameState(gameState);

  say(message, roll === 6 ? 'success' : roll === 5 ? 'info' : 'warning');

  setMenu({ type: 'end-turn' });
}
