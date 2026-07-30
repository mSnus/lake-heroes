import React from 'react';
import { Player } from '../game/Player';
import { useT } from '../i18n';
import '../styles/PlayerStats.css';

interface PlayerStatsProps {
  player: Player;
  showFame?: boolean;
  showGold?: boolean;
  showUnits?: boolean;
  /** When provided, a per-year income row is shown beneath the core stats. */
  income?: { gold: number; units: number };
  className?: string;
}

export const PlayerStats: React.FC<PlayerStatsProps> = ({
  player,
  showFame = true,
  showGold = true,
  showUnits = true,
  income,
  className,
}) => {
  const t = useT();
  return (
    <div className={'player-stats-wrapper' + (className ? ' ' + className : '')}>
      {showFame && (
        <div className="player-stat player-stat-fame">
          <strong>🏆 {player.fame ?? 1}</strong>
        </div>
      )}

      <div className="player-stats">
        <div className="player-stats-hint" style={{ backgroundColor: player.color }}>
          👛
        </div>

        {showGold && (
          <span className="player-stat">
            <strong>{player.gold ?? 0}🟡</strong>
          </span>
        )}
        {showUnits && (
          <span className="player-stat">
            <strong>
              {player.units ?? 0}🧍{player.riders > 0 ? ` (${player.riders}🐎)` : ''}
            </strong>
          </span>
        )}
      </div>
      {income && (
        <div className="player-stats-income" title={t('playerStats.incomePerYear')}>
          <div className="player-stats-hint" style={{ backgroundColor: player.color }}>
            🏰
          </div>
          <span className="player-stat">+{income.gold}🟡</span>
          <span className="player-stat">+{income.units}👬</span>
        </div>
      )}
    </div>
  );
};

export default PlayerStats;
