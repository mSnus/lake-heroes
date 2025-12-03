import React, { useMemo, useState } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import TileCard from './TileCard';
import { sellTile } from '../actions/sellTile';
import { say } from '../utils/say';
import '../styles/PlayerStatsTable.css';
import { isMobileLayout } from './board/common';

interface Props {
  board: GameState;
  updateGameState: (board: GameState) => void;
}

export const PlayerStatsTable: React.FC<Props> = ({ board, updateGameState }) => {
  const activePlayer = board.activePlayer as Player;

  // Map owned tiles and keep their indices
  const owned = useMemo(() => {
    const res: { tile: Tile; idx: number }[] = [];
    board.tiles.forEach((t: any, idx: number) => {
      if (t && t.owner === activePlayer.name) res.push({ tile: t as Tile, idx });
    });
    return res;
  }, [board, activePlayer.name]);

  const paneStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isMobileLayout() ? 'column' : 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 12,
    width: '100%',
    boxSizing: 'border-box',
  };

  const rightStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    width: '100%',
  };

  return (
    <div style={paneStyle}>
      <div style={rightStyle}>
        {owned.length === 0 && (
          <div className="poor-player">Poor {activePlayer.name} owns nothing</div>
        )}

        {owned.map(({ tile, idx }) => {
          return (
            <div key={idx} style={{ position: 'relative' }}>
              <TileCard
                tile={tile}
                mode="owned"
                gameState={board}
                updateGameState={updateGameState}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerStatsTable;
