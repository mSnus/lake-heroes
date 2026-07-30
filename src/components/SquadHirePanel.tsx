import React, { useState } from 'react';
import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import { RIDER_UNIT_PRICE, UNIT_PRICE } from '../game/constants';
import { useT } from '../i18n';
import '../styles/SquadHirePanel.css';

interface HireRowProps {
  player: Player;
  tier: UnitTier;
  label: string;
  emoji: string;
  unitPrice: number;
  maxForFame: number;
  onBuy: (amount: number, tier: UnitTier) => void;
}

const HireRow: React.FC<HireRowProps> = ({ player, tier, label, emoji, unitPrice, maxForFame, onBuy }) => {
  const t = useT();
  const goldCap = Math.floor(player.gold / unitPrice);
  const slotCap = player.remainingCapacity(tier);
  const maxAmount = Math.min(goldCap, maxForFame, slotCap);

  // Starts prefilled at the max; after a hire it resets to 0 instead of
  // re-filling to the (now lower) max, so repeat hires don't need re-zeroing
  // by hand. Only the mount-time default reacts to maxAmount — a later
  // change to it (e.g. selling on the other row) doesn't reset the input.
  const [amount, setAmount] = useState(maxAmount);

  const handleBuy = () => {
    onBuy(amount, tier);
    setAmount(0);
  };
  const handleHalf = () => setAmount(Math.floor(maxAmount / 2));
  const handleMax = () => setAmount(maxAmount);
  const handleInc = () => setAmount((a) => Math.min(maxAmount, a + 1));
  const handleDec = () => setAmount((a) => Math.max(0, a - 1));
  const handleIncBig = () => setAmount((a) => Math.min(maxAmount, a + 10));
  const handleDecBig = () => setAmount((a) => Math.max(0, a - 10));

  return (
    <div className="hire-row">
      <div className="hire-row-label">
        {emoji} {label} ({unitPrice}🟡)
      </div>
      <div className="units-input-row">
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            setAmount(Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(maxAmount, parsed)));
          }}
          min="0"
          max={maxAmount}
          style={{ width: '2rem' }}
          className="units-input"
        />
      </div>
      <div className="hire-row-buttons">
        <button className="game-menu-button small silver" onClick={handleDecBig}>
          -10
        </button>
        <button className="game-menu-button small silver" onClick={handleDec}>
          −
        </button>
        <button className="game-menu-button small silver" onClick={handleInc} disabled={amount >= maxAmount}>
          +
        </button>
        <button className="game-menu-button small silver" onClick={handleIncBig} disabled={amount >= maxAmount}>
          +10
        </button>
      </div>
      <div className="hire-row-buttons">
        <button className="game-menu-button silver" onClick={handleHalf}>
          {Math.floor(maxAmount / 2)}{emoji}
        </button>
        <button className="game-menu-button silver" onClick={handleMax}>
          {maxAmount}{emoji}
        </button>
        <button
          className="game-menu-button"
          onClick={handleBuy}
          disabled={!amount || amount <= 0 || amount > maxAmount}
        >
          {t('common.hire')} {amount > 0 ? amount : ''}{emoji}
        </button>
      </div>
    </div>
  );
};

interface SquadHirePanelProps {
  player: Player;
  /** Whether the Riders/Knights row should appear at all. */
  showRiders: boolean;
  onBuy: (amount: number, tier: UnitTier) => void;
}

/** Reusable "Hire:" panel — a Militia row always, and a Knights (Riders) row
 * only when `showRiders` is true. Each row hires independently, so a visit
 * can recruit both tiers without closing in between. */
export const SquadHirePanel: React.FC<SquadHirePanelProps> = ({ player, showRiders, onBuy }) => {
  const t = useT();
  const maxForFame = Math.max(0, 2 * player.fame + 3 - player.unitsHiredThisTurn);

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-panel-title">{t('squadHirePanel.hireTitle')}</div>
      <HireRow
        player={player}
        tier="militia"
        label={t('squadHirePanel.militia')}
        emoji="🧍"
        unitPrice={UNIT_PRICE}
        maxForFame={maxForFame}
        onBuy={onBuy}
      />
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          label={t('squadHirePanel.knights')}
          emoji="🐎"
          unitPrice={RIDER_UNIT_PRICE}
          maxForFame={maxForFame}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
