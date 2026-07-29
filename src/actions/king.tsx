import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { buyUnits } from './buyUnits';
import KingsCastleModal from '../components/KingsCastleModal';
import { say } from '../utils/say';
import { issueKingsContract } from '../game/kingsContracts';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle for', board.activePlayer);

  // Entering the castle resets this turn's hiring allowance. Tracking it on the
  // player (rather than in the modal) keeps the fame cap enforced even if the
  // screen is closed and reopened during the same visit.
  board.activePlayer.unitsHiredThisTurn = 0;

  const contract = issueKingsContract(board, board.activePlayer);
  if (contract) {
    const tileName = board.tiles[contract.tilePosition]?.name ?? 'a tile';
    say(`📜 The King hands you a contract: claim ${tileName} for ${contract.award}🟡!`, 'success');
    updateGameState(board);
  }

  showScreen({
    screenType: 'kings-castle',
    content: (
      <KingsCastleModal
        gameState={board}
        newContract={contract}
        onBuy={(amount, tier) => {
          clearScreen();
          buyUnits(board, amount, updateGameState, tier);
        }}
        onSkip={() => {
          clearScreen();
          setEndTurn();
        }}
      />
    ),
  });
}
