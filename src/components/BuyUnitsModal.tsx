import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import topImage from '../../public/assets/top1.jpg';

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
    <GameModal className="game-modal">
      <div className="modal-content">
        <img src={topImage} alt="Top Image" className="top-image" />
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
        <div className="button-group" style={{display:"flex", justifyContent:"center", gap: "8px", marginTop: "16px"}}>
          <button className="game-menu-button" onClick={handleBuy} disabled={amount <= 0 || amount > maxAmount}>
            Buy
          </button>
          <button className="game-menu-button" onClick={handleHalf}>1/2</button>
          <button className="game-menu-button" onClick={handleMax}>Max</button>
          <button className="game-menu-button" onClick={onSkip}>Skip</button>
        </div>
      </div>
    </GameModal>
  );
};

export default BuyUnitsModal;
