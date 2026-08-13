import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { useT } from '../i18n';
import '../styles/SquadHirePanel.css';

interface HireRowProps {
  player: Player;
  tier: UnitTier;
  label: string;
  emoji: string;
  unitPrice: number;
  onBuy: (amount: number, tier: UnitTier) => void;
}

const HireRow: React.FC<HireRowProps> = ({ player, tier, label, emoji, unitPrice, onBuy }) => {
  const t = useT();
  const goldCap = Math.floor(player.gold / unitPrice);
  const slotCap = player.remainingCapacity(tier);
  const maxAmount = Math.min(goldCap, slotCap);

  // Starts prefilled at the max; after a hire it resets to 0 instead of
  // re-filling to the (now lower) max, so repeat hires don't need re-zeroing
  // by hand. Only the mount-time default reacts to maxAmount — a later
  // change to it (e.g. selling on the other row) doesn't reset the input.
  const [amount, setAmount] = useState(maxAmount);

  // maxAmount can shrink after this row's own render — hiring on the OTHER
  // row spends the same shared gold, or a sale/purchase elsewhere changes
  // slot capacity. Keep the input from sitting above whatever's actually
  // still buyable.
  useEffect(() => {
    setAmount((a) => Math.min(a, maxAmount));
  }, [maxAmount]);

  const handleBuy = () => {
    onBuy(amount, tier);
    setAmount(0);
  };
  const handleInc = () => setAmount((a) => Math.min(maxAmount, a + 1));
  const handleDec = () => setAmount((a) => Math.max(0, a - 1));

  return (
    <div className="hire-row">
      <div className="hire-row-label">
        <div className="hire-row-name">{emoji} {label}</div>
        <div className="hire-row-price">
          {t('squadHirePanel.priceEachMax', { price: unitPrice, max: maxAmount })}
        </div>
      </div>
      <input
        type="number"
        value={amount}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          setAmount(Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(maxAmount, parsed)));
        }}
        min="0"
        max={maxAmount}
        className="units-input"
      />
      <button className="game-menu-button silver" onClick={handleDec}>
        −
      </button>
      <button className="game-menu-button silver" onClick={handleInc} disabled={amount >= maxAmount}>
        +
      </button>
      <button
        className="game-menu-button hire-submit"
        onClick={handleBuy}
        disabled={!amount || amount <= 0 || amount > maxAmount}
      >
        {t('squadHirePanel.hireButtonTitle')}
      </button>
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
  const ov = getOverrides();

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-panel-title">{t('squadHirePanel.hireTitle')}</div>
      <HireRow
        player={player}
        tier="militia"
        label={t('squadHirePanel.militia')}
        emoji="🧍"
        unitPrice={ov.militiaPrice}
        onBuy={onBuy}
      />
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          label={t('squadHirePanel.knights')}
          emoji="🐎"
          unitPrice={ov.riderPrice}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
