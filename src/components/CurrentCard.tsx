import React from 'react';
import { Board } from '../game/Board';
import { TileCard } from './TileCard';
import { Tile } from '../game/Tile';

interface CurrentTileProps {
  board: Board;
}

export const CurrentTile: React.FC<CurrentTileProps> = ({ board }) => {
  const [displayedTile, setDisplayedTile] = React.useState<Tile | null>(null);
  const activePlayer = board.activePlayer;
  const current = board.tiles[activePlayer.position];
  const shouldDisplay = current.isOwnable && !current.isOwned() || displayedTile !== current;

  React.useEffect(() => {
    function onTileClicked(e: Event) {
      const detail = (e as CustomEvent).detail;

      if (detail && detail.tile) {
        setDisplayedTile(detail.tile);
      } else {
        setDisplayedTile(null);
      }
    }
    window.addEventListener('tileClicked', onTileClicked as EventListener);
    return () => window.removeEventListener('tileClicked', onTileClicked as EventListener);
  }, []);

  return <div className="current-tile">{shouldDisplay && <TileCard tile={displayedTile ?? current} />}</div>;
};
