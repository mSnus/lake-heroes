import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { BattleScreen } from '../components/BattleScreen';
import { getPlayerImageSrc } from '../game/PlayerOptions';

export function checkCaravanEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;
  const ENCOUNTER_CHANCE = 1 / 12;

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
  if (Math.random() >= ENCOUNTER_CHANCE) return false;

  // Encounter!
  player.caravanEncounters = (player.caravanEncounters ?? 0) + 1;
  player.caravanEncounteredLastTurn = true;
  updateGameState(board);

  const defendingUnits = Math.floor((0.7 + Math.random() * 0.3) * player.units);
  const isSlaves = Math.random() < 0.4;
  
  const prize = isSlaves
    ? Math.max(1, Math.ceil(defendingUnits * (1.3 + Math.random() * 0.3)))
    : 100 * defendingUnits * (Math.floor(Math.random() * 2.3) + 1);

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
    ? `of ${prize}🧍⛓️ in chains`
    : `of goods worth ${prize}🟡`;

  showScreen({
    screenType: 'caravan',
    background: 'assets/screens/caravan.jpg',
    spriteImage: getPlayerImageSrc(player.image, player.fame),
    caravanDefence: defendingUnits,
    caravanPrize: prize,
    fade: true,
    htmlMessage: `<span style="color:${player.color}">${player.name}</span> <br />${player.gold}🟡 ${player.units}🧍<br /> encounters a caravan<br /> ${caravanDesc},
    <br /> guarded by ${defendingUnits}🥷<br /> Would you attack?`,
    buttons: [
      {
        label: '✖ Let \'em pass..',
        onClick: () => {
          clearScreen();
          onContinue();
        },
      },
      { label: '⚔️ Attack!', onClick: startBattle },
    ],
  });

  return true;
}
