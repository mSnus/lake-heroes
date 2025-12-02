import React from 'react';
import { GameState } from '../game/GameState';
import { TileCard } from './TileCard';
import { Tile } from '../game/Tile';

interface CurrentTileProps {
  board: GameState;
}

export const CurrentTile: React.FC<CurrentTileProps> = ({ board }) => {
  const [displayedTile, setDisplayedTile] = React.useState<Tile | null>(null);
  const activePlayer = board.activePlayer;
  const current = board.tiles[activePlayer.position];
  const shouldDisplay = (current.isOwnable && !current.isOwned()) || displayedTile !== current;

  React.useEffect(() => {
    function onsetViewedTitle(e: Event) {
      const detail = (e as CustomEvent).detail;

      if (detail && detail.tile) {
        setDisplayedTile(detail.tile);
      } else {
        setDisplayedTile(null);
      }
    }
    window.addEventListener('setViewedTitle', onsetViewedTitle as EventListener);
    return () => window.removeEventListener('setViewedTitle', onsetViewedTitle as EventListener);
  }, []);

  return (
    <div className="current-tile">
      {shouldDisplay && <TileCard tile={displayedTile ?? current} />}
    </div>
  );
};
