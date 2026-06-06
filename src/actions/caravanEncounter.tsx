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

  // Not enough units to threaten a caravan
  if (player.units < 3) return false;
  // No back-to-back
  if (player.caravanEncounteredLastTurn) {
    player.caravanEncounteredLastTurn = false;
    return false;
  }

  // Max 2 per year
  if ((player.caravanEncounters ?? 0) >= 2) return false;
  // 1/12 chance
  if (Math.random() >= 1 / 12) return false;

  // Encounter!
  player.caravanEncounters = (player.caravanEncounters ?? 0) + 1;
  player.caravanEncounteredLastTurn = true;
  updateGameState(board);

  const defendingUnits = Math.floor((0.7 + Math.random() * 0.3) * player.units);
  const isSlaves = Math.random() < 0.5;
  const prize = isSlaves
    ? Math.max(1, Math.floor(defendingUnits * (0.5 + Math.random() * 0.5)))
    : 100 * defendingUnits * (Math.floor(Math.random() * 2) + 1);

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
          caravanSlaves={isSlaves}
          onClose={onContinue}
        />
      ),
    });
  };

  const caravanDesc = isSlaves
    ? `bringing ${prize}🧍 in chains`
    : `bringing gold and jewels worth ${prize}🟡`;

  showScreen({
    screenType: 'caravan',
    background: 'assets/screens/caravan.jpg',
    caravanDefence: defendingUnits,
    caravanPrize: prize,
    htmlMessage: `<span style="color:${player.color}">${player.name}</span> encounters a caravan ${caravanDesc}. It is guarded by ${defendingUnits}🧍. Would you attack?`,
    buttons: [
      { label: 'Attack!', onClick: startBattle },
      {
        label: 'Let it pass..',
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
    ],
  });

  return true;
}
