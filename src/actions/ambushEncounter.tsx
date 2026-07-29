import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';

export function checkAmbushEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;
  const ENCOUNTER_CHANCE = 1 / 14;

  // No ambushes during the first lap around the board
  if ((player.circles ?? 0) < 1) return false;

  if (player.fame < 3) return false;
  if (player.armyPower < 5) return false;
  if (Math.random() >= ENCOUNTER_CHANCE) return false;

  // The ambushers field 50–70% of the player's units.
  const attackerUnits = Math.max(1, Math.round((0.5 + Math.random() * 0.2) * player.units));

  const startBattle = () => {
    showScreen({
      screenType: 'ambush-battle',
      content: (
        <BattleScreen
          mode="ambush"
          attacker={player}
          ambushAttackerUnits={attackerUnits}
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
    fade: true,
    spriteImage: 'assets/figures/npc-saracen.png',
    htmlMessage: `<span style="color:${player.color}">${player.name}</span> is ambushed!<br />A squad of ${attackerUnits}🥷 suddenly attacks. Fight for your lifes!`,
    buttons: [{ label: 'Defend', onClick: startBattle }],
  });

  return true;
}
