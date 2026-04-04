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
    <GameModal className="game-modal" backgroundImage="assets/screens/king.jpg" noBorder={true}>
      <div className="modal-content" style={{ color: `white` }}>
        <h2 className="game-title">
          The King welcomes you,
          <br /> {player.name}!
        </h2>
        <h3>{gameState.gameMessage}</h3>

        <h3>You may recruit units: 🧍 = 100 🟡</h3>

        <div
          className="input-group"
          style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}
        >
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

export default BuyUnitsModal;
