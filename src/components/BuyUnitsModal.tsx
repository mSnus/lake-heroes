import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';

interface BuyUnitsModalProps {
  gameState: GameState;
  onBuy: (amount: number) => void;
  onSkip: () => void;
}

const BuyUnitsModal: React.FC<BuyUnitsModalProps> = ({ gameState, onBuy, onSkip }) => {
  const player = gameState.activePlayer;
  const [amount, setAmount] = useState(0);

  const maxAmount = Math.floor(player.gold / 100);

  const handleBuy = () => {
    onBuy(amount);
  };

  const handleHalf = () => {
    const halfAmount = Math.floor(maxAmount / 2);
    setAmount(halfAmount);
  };

  const handleMax = () => {
    setAmount(maxAmount);
  };

  return (
    <div className="game-modal">
      <div className="modal-content">
        <img src="/path/to/your/image.png" alt="Top Image" className="top-image" />
        <h2>Buy Units</h2>
        <p>1 Unit = 100 Gold</p>
        <div className="input-group">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10))}
            min="0"
            max={maxAmount}
          />
        </div>
        <div className="button-group">
          <button onClick={handleBuy} disabled={amount <= 0 || amount > maxAmount}>Buy</button>
          <button onClick={handleHalf}>Half</button>
          <button onClick={handleMax}>Max</button>
          <button onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
};

export default BuyUnitsModal;
