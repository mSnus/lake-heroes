import React from 'react';
import { Player } from '../game/Player';
import '../styles/PlayerStats.css';

interface PlayerStatsProps {
  player: Player;
  showFame?: boolean;
  showGold?: boolean;
  showUnits?: boolean;
  className?: string;
}

/**
 * Reusable readout of a player's core stats (fame / gold / units), each toggle
 * able. Extracted from the player-pane so it can be shown in cards too.
 */
export const PlayerStats: React.FC<PlayerStatsProps> = ({
  player,
  showFame = true,
  showGold = true,
  showUnits = true,
  className,
}) => {
  return (
    <div className={'player-stats' + (className ? ' ' + className : '')}>
      {showFame && (
        <span className="player-stat player-stat-fame">
          <strong>🏆 {player.fame ?? 1}</strong>
        </span>
      )}
      {showGold && (
        <span className="player-stat">
          <strong>{player.gold ?? 0} 🟡</strong>
        </span>
      )}
      {showUnits && (
        <span className="player-stat">
          <strong>{player.units ?? 0} 🧍</strong>
        </span>
      )}
    </div>
  );
};

export default PlayerStats;
