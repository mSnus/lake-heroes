import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { buyUnits } from './buyUnits';
import KingsCastleModal from '../components/KingsCastleModal';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle for', board.activePlayer);

  showScreen({
    content: (
      <KingsCastleModal
        gameState={board}
        onBuy={(amount) => {
          clearScreen();
          buyUnits(board, amount, updateGameState);
        }}
        onSkip={() => {
          clearScreen();
          setEndTurn();
        }}
      />
    ),
  });
}
