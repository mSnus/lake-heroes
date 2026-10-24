import React, { useEffect, useState } from 'react';
import { Player } from '../../game/Player';
import { UnitTier } from '../../game/army';
import { getOverrides } from '../../utils/overridesStore';
import { DecoratedSlider } from './DecoratedSlider';
import { Militia } from '../snippets/Militia';
import { Rider } from '../snippets/Rider';
import { Fame } from '../snippets/Fame';
import { CostLabel } from '../snippets/CostLabel';
import { hireMax, unitCost } from '../../game/resources';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';
import '../../styles/SquadHirePanel.css';

interface HireRowProps {
  player: Player;
  tier: UnitTier;
  unitPrice: number;
  onBuy: (amount: number, tier: UnitTier) => void;
  /** Mirrors this row's live (pre-commit) slider amount up to the parent, so
   * a hire button elsewhere on the screen can reflect it (e.g. turn into
   * "Hire {amount}"). There's no buy control on the row itself -- every
   * caller needs this (and registerBuy) to actually let a purchase happen. */
  onAmountChange?: (tier: UnitTier, amount: number) => void;
  /** Hands the parent a way to buy this row's dialled-in amount -- stored in
   * a ref there (not state), since it's a closure that changes every render
   * and would never settle if compared for a state update. The row has no
   * buy button of its own, so this is the only way a hire actually happens. */
  registerBuy?: (tier: UnitTier, buy: () => void) => void;
}

const HireRow: React.FC<HireRowProps> = ({
  player,
  tier,
  unitPrice,
  onBuy,
  onAmountChange,
  registerBuy,
}) => {
  const UnitIcon = tier === 'riders' ? Rider : Militia;
  const maxAmount = hireMax(player, tier, unitPrice);
  // Distinct from maxAmount hitting 0 for lack of gold/food/arms -- this is
  // specifically "there's nowhere left to put one", the fame-driven army
  // cap itself, which a slider can't do anything about.
  const atFameCap = player.armyRoom(tier) <= 0;

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
  // committed on release -- null when not dragging, so the resources/labels
  // elsewhere fall back to the real (committed) `amount`.
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const displayedAmount = previewAmount ?? amount;

  // Dragging only picks the amount -- there's no per-row buy control
  // anymore, so the only way it's actually bought is the hire button
  // elsewhere on the screen (see registerBuy below).
  const handleBuy = () => {
    if (displayedAmount <= 0) return;
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

  return (
    <div className="hire-row">
      <div className="hire-row-name">
        <UnitIcon amount="" color={player.image} knight={player.isKnight} />
      </div>
      {atFameCap ? (
        <div className="hire-row-max-message">
          {tJsx('squadHirePanel.maxForFame', { fame: <Fame amount={player.fame} /> })}
        </div>
      ) : (
        <>
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
        </>
      )}
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
  const resolvedMilitiaPrice = militiaPrice ?? ov.militiaPrice;
  const resolvedRiderPrice = riderPrice ?? ov.riderPrice;

  return (
    <div className="squad-hire-panel">
      <div className="squad-hire-prices">
        {showMilitia && (
          <div className="squad-hire-price-row">
            <Militia amount="" color={player.image} knight={player.isKnight} />
            <CostLabel cost={unitCost('militia', resolvedMilitiaPrice)} />
          </div>
        )}
        <div className="squad-hire-price-row">
          <Rider amount="" color={player.image} />
          {showRiders ? (
            <CostLabel cost={unitCost('riders', resolvedRiderPrice)} />
          ) : (
            <span className="squad-hire-price-note">{t('squadHirePanel.ridersKnightOnly')}</span>
          )}
        </div>
      </div>

      <div className="squad-hire-panel-title">
        {titleMax !== undefined
          ? t('squadHirePanel.hireTitleMax', { max: titleMax })
          : t('squadHirePanel.hireTitlePlain')}
      </div>
      {showMilitia && (
        <HireRow
          player={player}
          tier="militia"
          unitPrice={resolvedMilitiaPrice}
          onBuy={onBuy}
          onAmountChange={onAmountChange}
          registerBuy={registerBuy}
        />
      )}
      {showRiders && (
        <HireRow
          player={player}
          tier="riders"
          unitPrice={resolvedRiderPrice}
          onAmountChange={onAmountChange}
          registerBuy={registerBuy}
          onBuy={onBuy}
        />
      )}
    </div>
  );
};

export default SquadHirePanel;
