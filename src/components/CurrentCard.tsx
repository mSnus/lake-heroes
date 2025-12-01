import React from 'react';
import { Board } from '../game/Board';
import { TileCard } from './TileCard';

interface CurrentTileProps {
  board: Board;
}

export const CurrentTile: React.FC<CurrentTileProps> = ({ board }) => {
  const activePlayer = board.activePlayer;
  const current = board.tiles[activePlayer.position];
  const shouldDisplay = current.isOwnable && !current.isOwned();

  return <div className="current-tile">{shouldDisplay && <TileCard tile={current} />}</div>;
};
