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

  // Starts at 0, and returns to 0 after a hire: buying is opt-in, so the
  // panel never opens with a purchase already dialled in.
  const [amount, setAmount] = useState(0);

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
    onBuy(displayedAmount, tier);
    setAmount(0);
    setPreviewAmount(null);
  };

  // Keyed off the displayed (live) amount, not the committed one, so the
  // button enables and prices itself as the thumb moves rather than waiting
  // for release -- it already shows the live total, so gating it on the
  // committed value made the two disagree mid-drag.
  const canBuy = displayedAmount > 0 && displayedAmount <= maxAmount;

  return (
    <div className="hire-row">
      <div className="hire-row-stack">
        <div className="hire-row-name">{emoji}</div>
        <div className="hire-row-caption">{unitPrice}🟡</div>
      </div>
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
  /** False where only riders are sold (the Stables). Defaults to true. */
  showMilitia?: boolean;
  onBuy: (amount: number, tier: UnitTier) => void;
  /** Overrides the militia/rider row's price -- the Tavern charges a
   * premium over the King's Castle's own prices (see tavern.ts's
   * tavernMilitiaPrice/tavernRiderPrice). */
  militiaPrice?: number;
  riderPrice?: number;
}

/** Reusable "Hire:" panel — a Militia row always, and a Knights (Riders) row
 * only when `showRiders` is true. Each row hires independently, so a visit
 * can recruit both tiers without closing in between. */
export const SquadHirePanel: React.FC<SquadHirePanelProps> = ({
  player,
  showRiders,
  showMilitia = true,
  onBuy,
  militiaPrice,
  riderPrice,
}) => {
  const t = useT();
  const ov = getOverrides();

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-panel-title">{t('squadHirePanel.hireTitle')}</div>
      {showMilitia && (
        <HireRow
          player={player}
          tier="militia"
          emoji="🧍"
          unitPrice={militiaPrice ?? ov.militiaPrice}
          onBuy={onBuy}
        />
      )}
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          emoji="🐎"
          unitPrice={riderPrice ?? ov.riderPrice}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
