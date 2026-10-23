import React, { useEffect, useState } from 'react';
import { Player } from '../../game/Player';
import { UnitTier } from '../../game/army';
import { getOverrides } from '../../utils/overridesStore';
import { DecoratedSlider } from './DecoratedSlider';
import { Gold } from '../snippets/Gold';
import { useT } from '../../i18n';
import '../../styles/SquadHirePanel.css';

interface HireRowProps {
  player: Player;
  tier: UnitTier;
  emoji: string;
  unitPrice: number;
  onBuy: (amount: number, tier: UnitTier) => void;
  /** Tavern only: mirrors this row's live (pre-commit) slider amount up to
   * the parent, so a footer button elsewhere can reflect it (e.g. turn into
   * "Hire {amount}"). */
  onAmountChange?: (tier: UnitTier, amount: number) => void;
  /** Tavern only: hands the parent a way to trigger this row's own buy
   * button remotely -- stored in a ref there (not state), since it's a
   * closure that changes every render and would never settle if compared
   * for a state update. */
  registerBuy?: (tier: UnitTier, buy: () => void) => void;
}

const HireRow: React.FC<HireRowProps> = ({
  player,
  tier,
  emoji,
  unitPrice,
  onBuy,
  onAmountChange,
  registerBuy,
}) => {
  const goldCap = Math.floor(player.gold / unitPrice);
  const maxAmount = Math.min(goldCap, player.armyRoom(tier));

  // Starts at 0, and returns to 0 after a hire: buying is opt-in, so the
  // panel never opens with a purchase already dialled in.
  const [amount, setAmount] = useState(0);

  // maxAmount can shrink after this row's own render — hiring on the OTHER
  // row spends the same shared gold, or a sale/purchase elsewhere changes
  // the army's room. Keep the slider from sitting above whatever's actually
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

  // No dependency array -- these just mirror the latest `displayedAmount`/
  // `handleBuy` out to the parent after every render. onAmountChange's own
  // setState is guarded against no-op updates there, and registerBuy only
  // ever writes a ref, so neither can loop.
  useEffect(() => {
    onAmountChange?.(tier, displayedAmount);
  });
  useEffect(() => {
    registerBuy?.(tier, handleBuy);
  });

  // Keyed off the displayed (live) amount, not the committed one, so the
  // button enables and prices itself as the thumb moves rather than waiting
  // for release -- it already shows the live total, so gating it on the
  // committed value made the two disagree mid-drag.
  const canBuy = displayedAmount > 0 && displayedAmount <= maxAmount;

  return (
    <div className="hire-row">
      <div className="hire-row-stack">
        <div className="hire-row-name">{emoji}</div>
        <div className="hire-row-caption">
          <Gold amount={unitPrice} />
        </div>
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
          <span className="hire-row-caption">
            <Gold amount={displayedAmount * unitPrice} />
          </span>
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
  /** Tavern only: shows "Hire more (max: N):" instead of the plain "Hire
   * more:" -- the militia row's own max (gold, fame-driven cap, and current
   * headcount all folded into one number). Every hire dialogue shows the
   * player's gold itself, so the title never repeats it. */
  titleMax?: number;
  /** See HireRow's own doc comments -- threaded straight through so a
   * footer button can mirror/drive the sliders (see useHireFooter). */
  onAmountChange?: (tier: UnitTier, amount: number) => void;
  registerBuy?: (tier: UnitTier, buy: () => void) => void;
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
  titleMax,
  onAmountChange,
  registerBuy,
}) => {
  const t = useT();
  const ov = getOverrides();

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-panel-title">
        {titleMax !== undefined
          ? t('squadHirePanel.hireTitleMax', { max: titleMax })
          : t('squadHirePanel.hireTitlePlain')}
      </div>
      {showMilitia && (
        <HireRow
          player={player}
          tier="militia"
          emoji="🧍"
          unitPrice={militiaPrice ?? ov.militiaPrice}
          onBuy={onBuy}
          onAmountChange={onAmountChange}
          registerBuy={registerBuy}
        />
      )}
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          emoji="🐎"
          unitPrice={riderPrice ?? ov.riderPrice}
          onAmountChange={onAmountChange}
          registerBuy={registerBuy}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
