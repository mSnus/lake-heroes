import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import KingsCastleModal from '../components/KingsCastleModal';
import { say } from '../utils/say';
import { issueKingsContract } from '../game/kingsContracts';
import { t } from '../i18n';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle for', board.activePlayer);

  const player = board.activePlayer;
  // Only roll for a contract the first time this screen opens per turn --
  // otherwise closing the modal and re-clicking the King's Castle tile
  // would keep re-rolling the 20% chance for free.
  let contract = null as ReturnType<typeof issueKingsContract>;
  if (!player.hasCheckedKingsContractThisTurn) {
    player.hasCheckedKingsContractThisTurn = true;
    contract = issueKingsContract(board, player);
    if (contract) {
      const tileName = board.tiles[contract.tilePosition]?.name ?? t('king.aTile');
      say(t('king.contractOffered', { tileName, award: contract.award }), 'success');
    }
    updateGameState(board);
  }

  showScreen({
    screenType: 'kings-castle',
    content: (
      <KingsCastleModal
        gameState={board}
        newContract={contract}
        onBuy={(amount, tier) => {
          buyUnits(board, amount, updateGameState, tier);
        }}
        onSell={(tier, amount) => {
          sellUnits(board, amount, updateGameState, tier);
        }}
        onSkip={() => {
          clearScreen();
          setEndTurn();
        }}
      />
    ),
  });
}
