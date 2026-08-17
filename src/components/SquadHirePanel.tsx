import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { UnitTier } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { DecoratedSlider } from './DecoratedSlider';
import { useT } from '../i18n';
import '../styles/SquadHirePanel.css';

interface HireRowProps {
  player: Player;
  tier: UnitTier;
  emoji: string;
  unitPrice: number;
  onBuy: (amount: number, tier: UnitTier) => void;
}

const HireRow: React.FC<HireRowProps> = ({ player, tier, emoji, unitPrice, onBuy }) => {
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
  // slot capacity. Keep the slider from sitting above whatever's actually
  // still buyable.
  useEffect(() => {
    setAmount((a) => Math.min(a, maxAmount));
  }, [maxAmount]);

  // Live value while the slider is being dragged, before it's actually
  // committed on release -- null when not dragging, so the price/labels
  // fall back to the real `amount`.
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const displayedAmount = previewAmount ?? amount;

  const handleBuy = () => {
    onBuy(amount, tier);
    setAmount(0);
  };

  const canBuy = !!amount && amount > 0 && amount <= maxAmount;

  return (
    <div className="hire-row">
      <div className="hire-row-stack">
        <div className="hire-row-name">{emoji}</div>
        <div className="hire-row-caption">{unitPrice}🟡</div>
      </div>
      <div className="hire-row-amount-label">0</div>
      <DecoratedSlider
        min={0}
        max={maxAmount}
        value={displayedAmount}
        onPreview={setPreviewAmount}
        onCommit={(v) => {
          setAmount(v);
          setPreviewAmount(null);
        }}
      />
      <div className="hire-row-amount-label">{displayedAmount}</div>
      <div className={'shield-button-container' + (canBuy ? '' : ' shield-button-container--disabled')}>
        <button className="shield-button hire-submit" onClick={handleBuy} disabled={!canBuy}>
          <span className="hire-submit-icon">👛</span>
          <span className="hire-row-caption">{displayedAmount * unitPrice}🟡</span>
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
  const ov = getOverrides();

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-panel-title">{t('squadHirePanel.hireTitle')}</div>
      <HireRow
        player={player}
        tier="militia"
        emoji="🧍"
        unitPrice={ov.militiaPrice}
        onBuy={onBuy}
      />
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          emoji="🐎"
          unitPrice={ov.riderPrice}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
