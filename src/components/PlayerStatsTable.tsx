import React from 'react';
import { Board } from '../game/Board';

interface PlayerStatsTableProps {
  board: Board;
}

export const PlayerStatsTable: React.FC<PlayerStatsTableProps> = ({ board }) => {
  return (
    <div style={{ marginTop: '20px', width: '100%', maxWidth: '800px' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#333', color: 'white' }}>
            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #555' }}>Gold</th>
            <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #555' }}>Units</th>
            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #555' }}>
              Owned Tiles
            </th>
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
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td
                  style={{
                    padding: '10px',
                    border: '1px solid #ddd',
                    fontWeight: 'bold',
                    color: player.color,
                  }}
                >
                  {player.name}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {player.gold}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {player.units}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{ownedTilesText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
