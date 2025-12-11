import React, { useMemo } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import TileCard from './TileCard';
import '../styles/PlayerStatsTable.css';

interface Props {
  gameState: GameState;
  updateGameState: (gameState: GameState) => void;
}

export const PlayerStatsTable: React.FC<Props> = ({ gameState, updateGameState }) => {
  if (!gameState) return <div></div>;

  const activePlayer = gameState.activePlayer as Player;

  // Map owned tiles and keep their indices
  const owned = useMemo(() => {
    const res: { tile: Tile; idx: number }[] = [];
    gameState.tiles.forEach((t: any, idx: number) => {
      if (t && t.owner === activePlayer.name) res.push({ tile: t as Tile, idx });
    });
    return res;
  }, [gameState, activePlayer.name]);

  return (
    <div className="player-pane-wrapper">
      <div className="player-pane-owned-cards">
        {owned.length === 0 && (
          <div className="poor-player">Poor {activePlayer.name} owns nothing</div>
        )}

        {owned.map(({ tile, idx }) => {
          return (
            <div key={idx} style={{ position: 'relative' }}>
              <TileCard
                tile={tile}
                mode="owned"
                gameState={gameState}
                updateGameState={updateGameState}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
