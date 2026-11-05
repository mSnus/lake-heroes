import React, { useState } from 'react';
import { UnitTier, formatArmyCap } from '../../game/army';
import { upgradeSquadCost } from '../../actions/upgradeSquad';
import { dismountRefund } from '../../actions/dismountSquad';
import { Cost, formatCost, maxAffordable, scaleCost, unitCost, upgradeCost } from '../../game/resources';
import { CostLabel } from '../snippets/CostLabel';
import { useT } from '../../i18n';
import Militia from '../snippets/Militia';
import Rider from '../snippets/Rider';
import { DecoratedSlider } from './DecoratedSlider';
import '../../styles/ArmyDisplay.css';
import '../../styles/SquadHirePanel.css';
import '../../styles/TileCard.css';

interface ArmyDisplayProps {
  militia: number;
  riders: number;
  capacity: { militia: number; riders: number };
  /** Knights, or anyone still holding riders. */
  showRiders: boolean;
  /** Player color key for the Militia/Rider sprites; omit for plain 🧍/🐎. */
  spriteColor?: string;
  /** A Knight's militia badge shows footmen instead -- riders unaffected. */
  isKnight?: boolean;
  /** When provided, a "sell" button under each tier opens a slider to sell
   * some. */
  onSell?: (tier: UnitTier, count: number) => void;
  /** When provided (with `canUpgradeToRiders`), a "mount" button under the
   * militia opens a slider to upgrade some to riders. */
  onUpgrade?: (count: number) => void;
  canUpgradeToRiders?: boolean;
  /** When provided, a "dismount" button under the riders opens a slider to
   * convert some back into militia. */
  onDismount?: (count: number) => void;
  /** The player's gold/food/arms -- what an upgrade can be paid from. */
  wallet?: { gold: number; food: number; arms: number };
  /** Overrides the per-unit upgrade price (the Tavern's premium). */
  upgradePricePerUnit?: number;
  /** Not-yet-bought units dialled into a hire slider elsewhere on the same
   * screen -- added to the badge's shown count (not to `militia`/`riders`
   * themselves, which stay the real, actually-ownable totals every sell/
   * upgrade max here is computed from). */
  pendingMilitia?: number;
  pendingRiders?: number;
  className?: string;
}

type PendingAction = { kind: 'sell'; tier: UnitTier } | { kind: 'upgrade' } | { kind: 'dismount' };

export const ArmyDisplay: React.FC<ArmyDisplayProps> = ({
  militia,
  riders,
  capacity,
  showRiders,
  spriteColor,
  isKnight = false,
  onSell,
  onUpgrade,
  canUpgradeToRiders = false,
  onDismount,
  wallet = { gold: 0, food: 0, arms: 0 },
  upgradePricePerUnit,
  pendingMilitia = 0,
  pendingRiders = 0,
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

  const dismountMax = Math.max(0, Math.min(riders, capacity.militia - militia));
  const canDismount = !!onDismount && dismountMax > 0;

  const maxFor = (action: PendingAction) =>
    action.kind === 'upgrade'
      ? upgradeMax
      : action.kind === 'dismount'
        ? dismountMax
        : action.tier === 'riders'
          ? riders
          : militia;
  const max = pending ? maxFor(pending) : 0;
  const shown = Math.min(previewAmount ?? amount, max);

  const toggle = (action: PendingAction) => {
    const same =
      action.kind === 'sell' ? pending?.kind === 'sell' && pending.tier === action.tier : pending?.kind === action.kind;
    setPending(same ? null : action);
    setAmount(0);
    setPreviewAmount(null);
  };

  const confirm = () => {
    if (!pending || shown <= 0) return;
    if (pending.kind === 'upgrade') onUpgrade?.(shown);
    else if (pending.kind === 'dismount') onDismount?.(shown);
    else onSell?.(pending.tier, shown);
    setPending(null);
    setAmount(0);
    setPreviewAmount(null);
  };

  // Paid for an upgrade, refunded for a dismount or a sale.
  const delta: Cost | null = !pending
    ? null
    : pending.kind === 'upgrade'
      ? upgradeSquadCost(shown, upgradePricePerUnit)
      : pending.kind === 'dismount'
        ? dismountRefund(shown)
        : scaleCost(unitCost(pending.tier), shown);

  const badge = (tier: UnitTier) => {
    const count = tier === 'riders' ? riders : militia;
    const pending = tier === 'riders' ? pendingRiders : pendingMilitia;
    const label = `${count + pending}`;
    const labelMax = `/ ${formatArmyCap(capacity[tier])}`;

    return (
      <>
        {tier === 'riders' ? (
          <Rider amount={label} color={spriteColor} maxAmount={labelMax} />
        ) : (
          <Militia amount={label} color={spriteColor} maxAmount={labelMax} knight={isKnight} />
        )}
      </>
    );
  };

  const actionButton = (action: PendingAction, disabled: boolean, title: string, label: React.ReactNode) => (
    <button
      className="tile-card-button tile-card-small-button"
      title={title}
      disabled={disabled}
      onClick={() => toggle(action)}
    >
      {label}
    </button>
  );

  return (
    <div className={['army-display', className].filter(Boolean).join(' ')}>
      <div className="squad-columns">
        <div className="squad-column">
          <span className="squad-badge">{badge('militia')}</span>
          {(onUpgrade && canUpgradeToRiders) || onSell ? (
            <div className="squad-column-actions">
              {onUpgrade &&
                canUpgradeToRiders &&
                actionButton(
                  { kind: 'upgrade' },
                  !canUpgrade,
                  t('armyDisplay.upgrade', { cost: formatCost(upgradeCost(upgradePricePerUnit)) }),
                  `🐎 ${t('armyDisplay.mount')}`
                )}
              {onSell &&
                actionButton(
                  { kind: 'sell', tier: 'militia' },
                  militia <= 0,
                  t('armyDisplay.sellMilitia'),
                  `🪙 ${t('armyDisplay.sell')}`
                )}
            </div>
          ) : null}
        </div>

        {showRiders && (
          <div className="squad-column">
            <span className="squad-badge">{badge('riders')}</span>
            {onDismount || onSell ? (
              <div className="squad-column-actions">
                {onDismount &&
                  actionButton(
                    { kind: 'dismount' },
                    !canDismount,
                    t('armyDisplay.dismountTitle', { cost: formatCost(dismountRefund(1)) }),
                    `🧍 ${t('armyDisplay.dismount')}`
                  )}
                {onSell &&
                  actionButton(
                    { kind: 'sell', tier: 'riders' },
                    riders <= 0,
                    t('armyDisplay.sellRiders'),
                    `🪙 ${t('armyDisplay.sell')}`
                  )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {pending && (
        <div className="hire-row army-action-row">
          <div className="hire-row-name">
            {pending.kind === 'upgrade'
              ? '🧍→🐎'
              : pending.kind === 'dismount'
                ? '🐎→🧍'
                : `✖️${pending.tier === 'riders' ? '🐎' : '🧍'}`}
          </div>
          <div className="army-action-slider-col">
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
            {delta && (
              <div className="army-action-cost">
                <CostLabel cost={delta} sign={pending?.kind === 'upgrade' ? '-' : '+'} />
              </div>
            )}
          </div>
          <div className="hire-row-amount-label">{shown}</div>
          <div className={'shield-button-container' + (shown > 0 ? '' : ' shield-button-container--disabled')}>
            <button
              className="shield-button hire-submit"
              title={t('armyDisplay.confirm')}
              onClick={confirm}
              disabled={shown <= 0}
            >
              <span className="hire-submit-icon">✔️</span>
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
