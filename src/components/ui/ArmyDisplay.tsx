import React, { useState } from 'react';
import { UnitTier, formatArmyCap } from '../../game/army';
import { upgradeSquadCost } from '../../actions/upgradeSquad';
import { Cost, formatCost, maxAffordable, scaleCost, unitCost, upgradeCost } from '../../game/resources';
import { CostLabel } from '../snippets/CostLabel';
import { useT } from '../../i18n';
import Militia from '../snippets/Militia';
import Rider from '../snippets/Rider';
import { DecoratedSlider } from './DecoratedSlider';
import '../../styles/ArmyDisplay.css';
import '../../styles/SquadHirePanel.css';

interface ArmyDisplayProps {
  militia: number;
  riders: number;
  capacity: { militia: number; riders: number };
  /** Knights, or anyone still holding riders. */
  showRiders: boolean;
  /** Player color key for the Militia/Rider sprites; omit for plain 🧍/🐎. */
  spriteColor?: string;
  /** When provided, a ✖️ next to each tier opens a slider to sell some. */
  onSell?: (tier: UnitTier, count: number) => void;
  /** When provided (with `canUpgradeToRiders`), a 🆙🐎 next to the militia
   * opens a slider to upgrade some to riders. */
  onUpgrade?: (count: number) => void;
  canUpgradeToRiders?: boolean;
  /** The player's gold/food/arms -- what an upgrade can be paid from. */
  wallet?: { gold: number; food: number; arms: number };
  /** Overrides the per-unit upgrade price (the Tavern's premium). */
  upgradePricePerUnit?: number;
  className?: string;
}

type PendingAction = { kind: 'sell'; tier: UnitTier } | { kind: 'upgrade' };

export const ArmyDisplay: React.FC<ArmyDisplayProps> = ({
  militia,
  riders,
  capacity,
  showRiders,
  spriteColor,
  onSell,
  onUpgrade,
  canUpgradeToRiders = false,
  wallet = { gold: 0, food: 0, arms: 0 },
  upgradePricePerUnit,
  className,
}) => {
  const t = useT();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [amount, setAmount] = useState(0);
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);

  const upgradeMax = Math.max(
    0,
    Math.min(militia, capacity.riders - riders, maxAffordable(wallet, upgradeCost(upgradePricePerUnit)))
  );
  const canUpgrade = !!onUpgrade && canUpgradeToRiders && upgradeMax > 0;

  const maxFor = (action: PendingAction) =>
    action.kind === 'upgrade' ? upgradeMax : action.tier === 'riders' ? riders : militia;
  const max = pending ? maxFor(pending) : 0;
  const shown = Math.min(previewAmount ?? amount, max);

  const toggle = (action: PendingAction) => {
    const same =
      action.kind === 'upgrade'
        ? pending?.kind === 'upgrade'
        : pending?.kind === 'sell' && pending.tier === action.tier;
    setPending(same ? null : action);
    setAmount(0);
    setPreviewAmount(null);
  };

  const confirm = () => {
    if (!pending || shown <= 0) return;
    if (pending.kind === 'upgrade') onUpgrade?.(shown);
    else onSell?.(pending.tier, shown);
    setPending(null);
    setAmount(0);
    setPreviewAmount(null);
  };

  // Paid for an upgrade, refunded for a sale.
  const delta: Cost | null = !pending
    ? null
    : pending.kind === 'upgrade'
      ? upgradeSquadCost(shown, upgradePricePerUnit)
      : scaleCost(unitCost(pending.tier), shown);

  const badge = (tier: UnitTier) => {
    const count = tier === 'riders' ? riders : militia;
    const label = `${count}`;
    const labelMax = `/ ${formatArmyCap(capacity[tier])}`;

    return (
      <>
        {tier === 'riders' ? (
          <Rider amount={label} color={spriteColor} maxAmount={labelMax} />
        ) : (
          <Militia amount={label} color={spriteColor} maxAmount={labelMax} />
        )}
      </>
    );
  };

  const tierChunk = (tier: UnitTier) => {
    const count = tier === 'riders' ? riders : militia;
    const showUpgrade = tier === 'militia' && !!onUpgrade && canUpgradeToRiders;

    return (
      <span className="squad-chunk">
        <span className="squad-badge">{badge(tier)}</span>
        {(onSell || showUpgrade) && (
          <span className="squad-chunk-actions">
            {onSell && (
              <button
                className={'squad-sell-button' + (count > 0 ? '' : ' squad-action-hidden')}
                title={t(tier === 'riders' ? 'armyDisplay.sellRiders' : 'armyDisplay.sellMilitia')}
                disabled={count <= 0}
                onClick={() => toggle({ kind: 'sell', tier })}
              >
                <span className="squad-sell-x">✖️</span>
                <span className="squad-sell-label">{t('armyDisplay.sell')}</span>
              </button>
            )}
            {showUpgrade && (
              <button
                className={'squad-upgrade-button' + (canUpgrade ? '' : ' squad-action-hidden')}
                title={t('armyDisplay.upgrade', { cost: formatCost(upgradeCost(upgradePricePerUnit)) })}
                disabled={!canUpgrade}
                onClick={() => toggle({ kind: 'upgrade' })}
              >
                🆙🐎
              </button>
            )}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className={['army-display', className].filter(Boolean).join(' ')}>
      <div className="squad-display">
        {tierChunk('militia')}
        {showRiders && tierChunk('riders')}
      </div>

      {pending && (
        <div className="hire-row army-action-row">
          <div className="hire-row-name">
            {pending.kind === 'upgrade' ? '🧍→🐎' : `✖️${pending.tier === 'riders' ? '🐎' : '🧍'}`}
          </div>
          <DecoratedSlider
            min={0}
            max={max}
            value={shown}
            onPreview={setPreviewAmount}
            onCommit={(v) => {
              setAmount(v);
              setPreviewAmount(null);
            }}
          />
          <div className="hire-row-amount-label">{shown}</div>
          <div className={'shield-button-container' + (shown > 0 ? '' : ' shield-button-container--disabled')}>
            <button
              className="shield-button hire-submit"
              title={t('armyDisplay.confirm')}
              onClick={confirm}
              disabled={shown <= 0}
            >
              <span className="hire-submit-icon">✔️</span>
              <span className="hire-row-caption">
                {delta && <CostLabel cost={delta} sign={pending?.kind === 'upgrade' ? '-' : '+'} />}
              </span>
            </button>
          </div>
          <button className="army-action-cancel" title={t('armyDisplay.cancel')} onClick={() => setPending(null)}>
            ✖
          </button>
        </div>
      )}
    </div>
  );
};

export default ArmyDisplay;
