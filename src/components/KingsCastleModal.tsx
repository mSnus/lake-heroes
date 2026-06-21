import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import topImage from '../../public/assets/top1.jpg';
import { UNIT_PRICE } from '../game/constants';
import { PlayerLabel } from './PlayerLabel';

interface BuyUnitsModalProps {
  gameState: GameState;
  onBuy: (amount: number) => void;
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({ gameState, onBuy, onSkip }) => {
  const player = gameState.activePlayer;

  const maxForFame = Math.max(0, 2 * player.fame + 3 - player.unitsHiredThisTurn);
  const maxAmount = Math.min(Math.floor(player.gold / UNIT_PRICE), maxForFame);

  const [amount, setAmount] = useState(maxAmount);

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
        <h3>{gameState.kingRewardMessage}</h3>

        <div style={{ fontFamily: 'Texturina' }}>
          The King welcomes <PlayerLabel player={player} />
          <div>
            {player.fame}🏆 {player.gold}🟡 {player.units}🧍
          </div>
        </div>

        <h3 style={{ fontFamily: 'Texturina' }}>
          Your money and fame are enough<br /> to recruit up to {maxAmount}🧍
          <br />
        </h3>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
          }}
        >
          <div className='units-input-row'>
            Recruit 
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10))}
              min="0"
              max={maxAmount}
              id="unitsInput"
              style={{ width: '3rem' }}
              className='units-input'
            />
            = {amount * UNIT_PRICE}🟡
        </div>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div className="game-menu-small-buttons">
              <button className="game-menu-button small silver" onClick={handleInc} disabled={amount >= maxAmount}>
                +
              </button>
              <button className="game-menu-button small silver" onClick={handleDec}>
                −
              </button>
            </div>
            <div className="game-menu-amounts">
              <button className="game-menu-button silver" onClick={handleHalf}>
                {Math.floor(maxAmount/2)}🧍
              </button>
              <button className="game-menu-button silver" onClick={handleThreeQuarters}>
                {Math.floor(maxAmount*3/4)}🧍
              </button>
              <button className="game-menu-button silver" onClick={handleMax}>
                {maxAmount}🧍
              </button>
            </div>
          </div>
        </div>
        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <button className="game-menu-button" onClick={onSkip}>
            ✖ I don't need 'em 
          </button>

          <button
            className="game-menu-button"
            onClick={handleBuy}
            disabled={amount <= 0 || amount > maxAmount}
          >
            Hire {amount}🧍
          </button>
        </div>
      </div>
    </GameModal>
  );
};

export default KingsCastleModal;
