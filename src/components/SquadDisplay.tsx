import React from 'react';
import { buildSquadChunks } from '../game/army';
import { upgradeSquadCost } from '../actions/upgradeSquad';
import { useT } from '../i18n';
import '../styles/SquadDisplay.css';

interface SquadDisplayProps {
  militia: number;
  riders: number;
  totalSlots: number;
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
  className?: string;
}

export const SquadDisplay: React.FC<SquadDisplayProps> = ({
  militia,
  riders,
  totalSlots,
  onSellSquad,
  onUpgradeSquad,
  canUpgradeToRiders = false,
  playerGold = 0,
  className,
}) => {
  const t = useT();
  const chunks = buildSquadChunks(militia, riders, totalSlots);

  return (
    <div className={['squad-display', className].filter(Boolean).join(' ')}>
      {chunks.map((chunk, i) => {
        const upgradeCost = upgradeSquadCost(chunk.count);
        const showUpgrade =
          !!onUpgradeSquad &&
          canUpgradeToRiders &&
          chunk.tier === 'militia' &&
          chunk.count > 0 &&
          playerGold >= upgradeCost;

        return (
          <span key={i} className="squad-chunk">
            <span className="squad-badge">
              {chunk.count}
              {chunk.tier === 'riders' ? '🐎' : '🧍'}
            </span>
            {((onSellSquad && chunk.count > 0) || showUpgrade) && (
              <span className="squad-chunk-actions">
                {onSellSquad && chunk.count > 0 && (
                  <button
                    className="squad-sell-button"
                    title={t('squadDisplay.sellSquad')}
                    onClick={() => onSellSquad(chunk.tier, chunk.count)}
                  >
                    <span className="squad-sell-x">✖️</span>
                    <span className="squad-sell-label">{t('squadDisplay.sell')}</span>
                  </button>
                )}
                {showUpgrade && (
                  <button
                    className="squad-upgrade-button"
                    title={t('squadDisplay.upgradeSquad', { gold: upgradeCost })}
                    onClick={() => onUpgradeSquad!(chunk.count)}
                  >
                    🆙🐎
                  </button>
                )}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

export default SquadDisplay;
