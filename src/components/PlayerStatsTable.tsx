import React from 'react';
import { Board } from '../game/Board';
import './PlayerStatsTable.css';

interface PlayerStatsTableProps {
  board: Board;
}

export const PlayerStatsTable: React.FC<PlayerStatsTableProps> = ({ board }) => {
  return (
    <div className="player-stats-container">
      <table className="player-stats-table">
        <thead>
          <tr className="player-stats-header">
            <th className="player-stats-header-cell">Name</th>
            <th className="player-stats-header-cell">Gold</th>
            <th className="player-stats-header-cell">Units</th>
            <th className="player-stats-header-cell">Owned Tiles</th>
          </tr>
        </thead>
        <tbody>
          {board.players.map((player, idx) => {
            const ownedTilesText =
              player.ownedTiles
                .map((tileIdx) => {
                  const tile = board.tiles[tileIdx];
                  return `${tile.name} (${tile.level})`;
                })
                .join(', ') || 'None';

            return (
              <tr
                key={idx}
                className={idx % 2 === 0 ? 'player-stats-row' : 'player-stats-row-alt'}
              >
                <td
                  className="player-stats-cell player-stats-name"
                  style={{ color: player.color }}
                >
                  {player.name}
                </td>
                <td className="player-stats-cell player-stats-cell-right">{player.gold}</td>
                <td className="player-stats-cell player-stats-cell-right">{player.units}</td>
                <td className="player-stats-cell">{ownedTilesText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
