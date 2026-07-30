import React, { useEffect, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/modal.css';
import GameModal from './GameModal';
import { KNIGHT_FAME, RIDER_UNIT_PRICE, UNIT_PRICE } from '../game/constants';
import { UnitTier } from '../game/army';
import { PlayerLabel } from './PlayerLabel';
import { pickKingsCastleHireAmount, pickKingsCastleHireTier } from '../ai/decisions';
import { KingsContract } from '../game/kingsContracts';

interface BuyUnitsModalProps {
  gameState: GameState;
  /** Only a contract issued on THIS visit is shown; carried-over ones are not. */
  newContract?: KingsContract | null;
  onBuy: (amount: number, tier: UnitTier) => void;
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({ gameState, newContract, onBuy, onSkip }) => {
  const player = gameState.activePlayer;

  const contract = newContract ?? null;
  const contractTile = contract ? gameState.tiles[contract.tilePosition] : null;

  const [tier, setTier] = useState<UnitTier>('militia');
  const canRecruitRiders = player.fame >= KNIGHT_FAME;
  const unitPrice = tier === 'riders' ? RIDER_UNIT_PRICE : UNIT_PRICE;

  const maxForFame = Math.max(0, 2 * player.fame + 3 - player.unitsHiredThisTurn);
  const goldCap = Math.floor(player.gold / unitPrice);
  const slotCap = player.remainingCapacity(tier);
  const maxAmount = Math.min(goldCap, maxForFame, slotCap);

  // Which constraint is actually holding maxAmount back, for a clear reason
  // shown next to the Recruit input — otherwise a low/zero max looks like a
  // bug. Checked in priority order (slots first — the least obvious cap);
  // only reported when it's uniquely binding, not just tied for the minimum.
  const limitReason =
    maxAmount === 0 || maxAmount < Math.max(goldCap, maxForFame, slotCap)
      ? slotCap === maxAmount
        ? `🏯 army slots full (${player.slotsUsed}/${player.armySlots} used)`
        : maxForFame === maxAmount
          ? "today's hiring limit reached"
          : 'not enough gold'
      : null;

  const [amount, setAmount] = useState(maxAmount);
  useEffect(() => setAmount(maxAmount), [maxAmount]);

  const handleBuy = () => {
    onBuy(amount, tier);
  };

  const handleHalf = () => setAmount(Math.floor(maxAmount / 2));
  const handleThreeQuarters = () => setAmount(Math.floor((maxAmount * 3) / 4));
  const handleMax = () => setAmount(maxAmount);
  const handleInc = () => setAmount((a) => Math.min(maxAmount, a + 1));
  const handleDec = () => setAmount((a) => Math.max(0, a - 1));

  useEffect(() => {
    if (!player.isComputer) return;
    const botTier = pickKingsCastleHireTier(player);
    const botUnitPrice = botTier === 'riders' ? RIDER_UNIT_PRICE : UNIT_PRICE;
    const botMaxAmount = Math.min(
      Math.floor(player.gold / botUnitPrice),
      Math.max(0, 2 * player.fame + 3 - player.unitsHiredThisTurn),
      player.remainingCapacity(botTier)
    );
    const hireAmount = pickKingsCastleHireAmount(player, botMaxAmount, botUnitPrice);
    const t = setTimeout(() => (hireAmount > 0 ? onBuy(hireAmount, botTier) : onSkip()), 600);
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
          to grow your army from <span className="value">{player.militia}🧍/{player.riders}🐎</span> up to{' '}
          <span className="value">
            {tier === 'militia' ? player.militia + maxAmount : player.militia}🧍/
            {tier === 'riders' ? player.riders + maxAmount : player.riders}🐎
          </span>
          <br />
          🏯 Army slots: <span className="value">{player.slotsUsed}/{player.armySlots}</span> used
          {' '}(each holds up to 10 of one kind)
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
          <div className="button-group" style={{ display: 'flex', gap: '8px' }}>
            <button
              className={'game-menu-button' + (tier === 'militia' ? ' silver' : '')}
              onClick={() => setTier('militia')}
            >
              🧍 Militia ({UNIT_PRICE}🟡)
            </button>
            <button
              className={'game-menu-button' + (tier === 'riders' ? ' silver' : '')}
              onClick={() => canRecruitRiders && setTier('riders')}
              disabled={!canRecruitRiders}
              title={canRecruitRiders ? '' : `Reach fame ${KNIGHT_FAME} to recruit Riders`}
            >
              🐎 Riders ({RIDER_UNIT_PRICE}🟡){canRecruitRiders ? '' : ' 🔒'}
            </button>
          </div>
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
            {amount > 0 && amount <= maxAmount && (<>so you'll have <span className="value">{(tier === 'militia' ? player.militia : player.riders) + amount}{tier === 'militia' ? '🧍' : '🐎'}</span> and <span className="value">{player.gold - amount * unitPrice}🟡</span></>)}
            {limitReason && <span style={{ color: '#ff8080' }}>max {maxAmount} — {limitReason}</span>}

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
