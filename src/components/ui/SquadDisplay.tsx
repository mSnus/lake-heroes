import React from 'react';
import { buildSquadChunks } from '../../game/army';
import { upgradeSquadCost } from '../../actions/upgradeSquad';
import { useT } from '../../i18n';
import Militia from '../snippets/Militia';
import Rider from '../snippets/Rider';
import '../../styles/SquadDisplay.css';

interface SquadDisplayProps {
  militia: number;
  riders: number;
  totalSlots: number;
  /** Player color key for the Militia/Rider sprites -- when provided, the
   * badges show the colored sprite instead of the plain 🧍/🐎 emoji. Omit to
   * keep the plain emoji (every caller except the player-stats panel). */
  spriteColor?: string;
  /** Slots beyond `totalSlots` (the player's current fame-based allowance),
   * up to this absolute cap, render as locked/disabled boxes instead of
   * being left out entirely -- so more squads than fame currently allows
   * are still visible, just grayed. Defaults to `totalSlots` (no locked
   * boxes), the behavior every existing caller keeps. */
  maxSlots?: number;
  /** When provided, a ✖️ button appears next to every non-empty squad,
   * calling back with that squad's tier/count to sell. Omit for read-only
   * display (e.g. the player-stats panel). */
  onSellSquad?: (tier: 'militia' | 'riders', count: number) => void;
  /** When provided (together with `canUpgradeToRiders` and `playerGold`), a
   * 🆙 button appears under a militia squad's sell button to convert the
   * whole squad to Riders -- hidden unless the player can recruit riders at
   * all AND has enough gold to upgrade that specific squad. */
  onUpgradeSquad?: (count: number) => void;
  canUpgradeToRiders?: boolean;
  playerGold?: number;
  /** Overrides the per-unit upgrade price -- the Tavern charges its own
   * premium rate (see tavern.ts's tavernUpgradePricePerUnit). */
  upgradePricePerUnit?: number;
  className?: string;
}

export const SquadDisplay: React.FC<SquadDisplayProps> = ({
  militia,
  riders,
  totalSlots,
  maxSlots = totalSlots,
  spriteColor,
  onSellSquad,
  onUpgradeSquad,
  canUpgradeToRiders = false,
  playerGold = 0,
  upgradePricePerUnit,
  className,
}) => {
  const t = useT();
  const chunks = buildSquadChunks(militia, riders, totalSlots);
  const lockedSlots = Math.max(0, maxSlots - totalSlots);

  return (
    <div className={['squad-display', className].filter(Boolean).join(' ')}>
      {chunks.map((chunk, i) => {
        const upgradeCost = upgradeSquadCost(chunk.count, upgradePricePerUnit);
        const canSell = !!onSellSquad && chunk.count > 0;
        const canUpgrade =
          !!onUpgradeSquad &&
          canUpgradeToRiders &&
          chunk.tier === 'militia' &&
          chunk.count > 0 &&
          playerGold >= upgradeCost;

        return (
          <span key={i} className="squad-chunk">
            <span className="squad-badge">
              {spriteColor ? (
                chunk.tier === 'riders' ? (
                  <Rider amount={chunk.count > 0 ? chunk.count : '‒'} color={spriteColor} />
                ) : (
                  <Militia amount={chunk.count > 0 ? chunk.count : '‒'} color={spriteColor} />
                )
              ) : (
                <>
                  {chunk.count > 0 ? chunk.count : '‒'} {chunk.tier === 'riders' ? '🐎' : '🧍'}
                </>
              )}
            </span>
            {/* Buttons always render when the capability is offered at all
                (onSellSquad/onUpgradeSquad provided), even for a squad that
                can't currently use them -- hidden via opacity+disabled rather
                than left out of the layout, so every squad's actions row
                keeps the same footprint and the buttons stay pinned to the
                same left/right edges across the whole hire dialogue. */}
            {(onSellSquad || onUpgradeSquad) && (
              <span className="squad-chunk-actions">
                {onSellSquad && (
                  <button
                    className={'squad-sell-button' + (canSell ? '' : ' squad-action-hidden')}
                    title={t('squadDisplay.sellSquad')}
                    disabled={!canSell}
                    onClick={() => onSellSquad(chunk.tier, chunk.count)}
                  >
                    <span className="squad-sell-x">✖️</span>
                    <span className="squad-sell-label">{t('squadDisplay.sell')}</span>
                  </button>
                )}
                {onUpgradeSquad && (
                  <button
                    className={'squad-upgrade-button' + (canUpgrade ? '' : ' squad-action-hidden')}
                    title={t('squadDisplay.upgradeSquad', { gold: upgradeCost })}
                    disabled={!canUpgrade}
                    onClick={() => onUpgradeSquad(chunk.count)}
                  >
                    🆙🐎
                  </button>
                )}
              </span>
            )}
          </span>
        );
      })}
      {/* Beyond totalSlots, up to maxSlots -- same box as an empty available
          slot, just grayed and inert, so more fame's extra squads are
          visible as a goal rather than simply missing. */}
      {Array.from({ length: lockedSlots }, (_, i) => (
        <span key={`locked-${i}`} className="squad-chunk squad-chunk-locked">
          <span className="squad-badge">
            {spriteColor ? <Militia amount="" color={spriteColor} /> : '🧍'}
          </span>
        </span>
      ))}
    </div>
  );
};

export default SquadDisplay;
