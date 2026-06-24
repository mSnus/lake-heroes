import React, { useEffect, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import { UNIT_PRICE } from '../game/constants';
import { PlayerLabel } from './PlayerLabel';
import { pickKingsCastleHireAmount } from '../ai/decisions';
import { KingsContract } from '../game/kingsContracts';

interface BuyUnitsModalProps {
  gameState: GameState;
  /** Only a contract issued on THIS visit is shown; carried-over ones are not. */
  newContract?: KingsContract | null;
  onBuy: (amount: number) => void;
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({ gameState, newContract, onBuy, onSkip }) => {
  const player = gameState.activePlayer;

  const contract = newContract ?? null;
  const contractTile = contract ? gameState.tiles[contract.tilePosition] : null;

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

  useEffect(() => {
    if (!player.isComputer) return;
    const hireAmount = pickKingsCastleHireAmount(player, maxAmount);
    const t = setTimeout(() => (hireAmount > 0 ? onBuy(hireAmount) : onSkip()), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/king.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content" style={{ color: `white`, fontFamily: 'Texturina' }}>
        <h2 className="game-title">The King's Castle</h2>
        <h3>{gameState.kingRewardMessage}, <PlayerLabel player={player} /></h3>

        {contract && contractTile && (
          <h3 className='king-contract'>📜 New contract: be the first to claim<br/> {contractTile.name} for a reward of <span className="value">{contract.award}</span>🟡!</h3>
        )}

        <h3>
          Your money <span className="value">{player.gold}🟡</span> and fame <span className="value">{player.fame}</span>🏆  are enough<br />
          to grow your army from <span className="value">{player.units}</span>🧍 up to <span className="value">{player.units + maxAmount}</span>🧍
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
              style={{ width: '2rem' }}
              className='units-input'
            />
            {amount > 0 && amount <= maxAmount && (<>so you'll have <span className="value">{player.units + amount}🧍</span> and <span className="value">{player.gold - amount * UNIT_PRICE}🟡</span></>)}
            
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
            disabled={!amount || amount <= 0 || amount > maxAmount}
          >
            Hire {amount > 0 ? amount : ''}🧍
          </button>
        </div>
      </div>
    </GameModal>
  );
};

export default KingsCastleModal;
