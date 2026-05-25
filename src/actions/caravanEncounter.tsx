import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';

export function checkCaravanEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;

  // No back-to-back
  if (player.caravanEncounteredLastTurn) {
    player.caravanEncounteredLastTurn = false;
    return false;
  }
  // Max 2 per circle
  if ((player.caravanEncounters ?? 0) >= 2) return false;
  // 1/12 chance
  if (Math.random() >= 1 / 12) return false;

  // Encounter!
  player.caravanEncounters = (player.caravanEncounters ?? 0) + 1;
  player.caravanEncounteredLastTurn = true;
  updateGameState(board);

  const defendingUnits = Math.floor((0.7 + Math.random() * 0.3) * player.units);
  const prize = 100 * defendingUnits * (Math.floor(Math.random() * 4) + 1);

  const startBattle = () => {
    showScreen({
      screenType: 'caravan-battle',
      caravanDefence: defendingUnits,
      caravanPrize: prize,
      content: (
        <BattleScreen
          mode="caravan"
          attacker={player}
          gameState={board}
          updateGameState={updateGameState}
          caravanDefence={defendingUnits}
          caravanPrize={prize}
          onClose={onContinue}
        />
      ),
    });
  };

  showScreen({
    screenType: 'caravan',
    background: 'assets/screens/caravan.jpg',
    caravanDefence: defendingUnits,
    caravanPrize: prize,
    message: `You encounter a caravan passing behind the hills, bringing gold and jewels worth ${prize}🟡. It is guarded by ${defendingUnits}🧍. Would you attack?`,
    buttons: [
      { label: 'Attack!', onClick: startBattle },
      { label: 'Let it pass..', onClick: () => { clearScreen(); onContinue(); } },
    ],
  });

  return true;
}
