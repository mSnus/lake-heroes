import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { AmbushScreen } from '../components/AmbushScreen';

export function checkAmbushEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;
  const ENCOUNTER_CHANCE = 1 / 14;

  // Need a meaningful force to be worth ambushing.
  if (player.units < 5) return false;
  if (Math.random() >= ENCOUNTER_CHANCE) return false;

  // The ambushers field 50–70% of the player's units.
  const attackerUnits = Math.max(1, Math.round((0.5 + Math.random() * 0.2) * player.units));

  const startBattle = () => {
    showScreen({
      screenType: 'ambush-battle',
      content: (
        <AmbushScreen
          player={player}
          attackerUnits={attackerUnits}
          gameState={board}
          updateGameState={updateGameState}
          onClose={onContinue}
        />
      ),
    });
  };

  showScreen({
    screenType: 'ambush',
    background: 'assets/screens/caravan.jpg',
    title: 'Ambush',
    spriteImage: 'assets/figures/npc-saracen.png',
    htmlMessage: `<span style="color:${player.color}">${player.name}</span> is ambushed!<br /><br /> ${attackerUnits}🧍 spring from cover to attack. Hold the line!`,
    buttons: [{ label: '🛡️ Defend!', onClick: startBattle }],
  });

  return true;
}
