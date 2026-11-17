import React from 'react';
import { Player } from '../../game/Player';
import { formatArmy } from '../../utils/formatArmy';
import { Gold } from '../snippets/Gold';
import '../../styles/PlayerStats.css';

interface PlayerStatsProps {
  player: Player;
  showFame?: boolean;
  showGold?: boolean;
  showUnits?: boolean;
  className?: string;
}

export const PlayerStats: React.FC<PlayerStatsProps> = ({
  player,
  showFame = true,
  showGold = true,
  showUnits = true,
  className,
}) => {
  return (
    <div className={'player-stats-wrapper' + (className ? ' ' + className : '')}>
      {showFame && (
        <div className="player-stat player-stat-fame">
          <strong>🏆 {player.fame ?? 1}</strong>
        </div>
      )}

      <div className="player-stats">
        <div className="player-stats-hint player-wallet" style={{ backgroundColor: player.color }}>
          👛
        </div>

        {showGold && (
          <span className="player-stat">
            <strong>
              <Gold amount={player.gold ?? 0} />
            </strong>
          </span>
        )}
        {showUnits && (
          <span className="player-stat">
            <strong>{formatArmy(player.militia ?? 0, player.riders ?? 0)}</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default PlayerStats;
