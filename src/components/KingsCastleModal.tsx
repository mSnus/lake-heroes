import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import topImage from '../../public/assets/top1.jpg';
import { UNIT_PRICE } from '../game/constants';

interface BuyUnitsModalProps {
  gameState: GameState;
  onBuy: (amount: number) => void;
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({ gameState, onBuy, onSkip }) => {
  const player = gameState.activePlayer;
  const [amount, setAmount] = useState(0);

  const maxForFame = player.fame * 5;
  const maxAmount = Math.min(Math.floor(player.gold / UNIT_PRICE), maxForFame);

  const handleBuy = () => {
    onBuy(amount);
  };

  const handleHalf = () => setAmount(Math.floor(maxAmount / 2));
  const handleThreeQuarters = () => setAmount(Math.floor((maxAmount * 3) / 4));
  const handleMax = () => setAmount(maxAmount);
  const handleInc = () => setAmount((a) => Math.min(maxAmount, a + 1));
  const handleDec = () => setAmount((a) => Math.max(0, a - 1));

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/king.jpg"
      noBorder={true}
      style={{ backgroundColor: 'background-color: rgba(0, 0, 0, 0.3);' }}
    >
      <div className="modal-content" style={{ color: `white` }}>
        <h2 className="game-title">The King's Castle</h2>
        <h3>{gameState.gameMessage}</h3>

        <h3>
          With fame of {player.fame}🏆, you may recruit up to {maxAmount} units for a cost of {maxAmount * UNIT_PRICE}🟡
        </h3>

        <div
          className="input-group"
          style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button className="game-menu-button" onClick={handleInc}>
              +
            </button>
            <button className="game-menu-button" onClick={handleDec}>
              −
            </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10))}
            min="0"
            max={maxAmount}
          />
          <button className="game-menu-button" onClick={handleHalf}>
            1/2
          </button>
          <button className="game-menu-button" onClick={handleThreeQuarters}>
            3/4
          </button>
          <button className="game-menu-button" onClick={handleMax}>
            Max
          </button>
        </div>
        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <button className="game-menu-button" onClick={onSkip}>
            Skip
          </button>

          <button
            className="game-menu-button"
            onClick={handleBuy}
            disabled={amount <= 0 || amount > maxAmount}
          >
            Buy
          </button>
        </div>
      </div>
    </GameModal>
  );
};

export default KingsCastleModal;
