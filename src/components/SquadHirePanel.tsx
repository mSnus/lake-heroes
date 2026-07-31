import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import { ARMY_SLOT_CAPACITY, RIDER_UNIT_PRICE, UNIT_PRICE } from '../game/constants';
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

  // Tops off the currently-open slot (the tier's count isn't a multiple of
  // ARMY_SLOT_CAPACITY) rather than starting a new one; falls back to the
  // full max when there's no partial slot to fill (an exact multiple, incl.
  // zero).
  const tierCount = tier === 'riders' ? player.riders : player.militia;
  const unitsInOpenSlot = tierCount % ARMY_SLOT_CAPACITY;
  const fillSlotAmount =
    unitsInOpenSlot > 0 ? Math.min(ARMY_SLOT_CAPACITY - unitsInOpenSlot, maxAmount) : maxAmount;

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
  const handleFillSlot = () => setAmount(fillSlotAmount);
  const handleMax = () => setAmount(maxAmount);
  const handleInc = () => setAmount((a) => Math.min(maxAmount, a + 1));
  const handleDec = () => setAmount((a) => Math.max(0, a - 1));

  return (
    <div className="hire-row">
      <div className="hire-row-top">
        <div className="hire-row-label">
          {emoji} {label} {t('squadHirePanel.priceEachMax', { price: unitPrice, max: maxAmount })}
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
      </div>
      <div className="hire-row-controls">
        <div className="hire-stack">
          <button className="game-menu-button small silver" onClick={handleDec}>
            -1
          </button>
          <button className="game-menu-button small silver" onClick={handleInc} disabled={amount >= maxAmount}>
            +1
          </button>
        </div>
        <button className="game-menu-button silver hire-fraction" onClick={handleFillSlot}>
          {fillSlotAmount}{emoji}
        </button>
        <button className="game-menu-button silver hire-fraction" onClick={handleMax}>
          {maxAmount}{emoji}
        </button>
        <button
          className="game-menu-button hire-submit"
          onClick={handleBuy}
          disabled={!amount || amount <= 0 || amount > maxAmount}
        >
          {t('squadHirePanel.hireButtonTitle')}
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

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-panel-title">{t('squadHirePanel.hireTitle')}</div>
      <HireRow
        player={player}
        tier="militia"
        label={t('squadHirePanel.militia')}
        emoji="🧍"
        unitPrice={UNIT_PRICE}
        onBuy={onBuy}
      />
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          label={t('squadHirePanel.knights')}
          emoji="🐎"
          unitPrice={RIDER_UNIT_PRICE}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
