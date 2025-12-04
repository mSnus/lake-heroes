import React from 'react';
import { GameState } from '../game/GameState';
import { TileCard } from './TileCard';
import { Tile } from '../game/Tile';

interface CurrentTileProps {
  gameState: GameState;
}

export const CurrentTile: React.FC<CurrentTileProps> = ({ gameState }) => {
  const [displayedTile, setDisplayedTile] = React.useState<Tile | null>(null);
  const [shouldDisplay, setShouldDisplay] = React.useState<boolean>(true);

  const current = gameState.activeTile;
  if (gameState.turns === 0 && gameState.turnPhase === 'before-move' && shouldDisplay !== false) {
        setShouldDisplay(false);
      } 
  React.useEffect(() => {
    function ondisplayTitle(e: Event) {
      const detail = (e as CustomEvent).detail;
      let display = 
        (detail !== null && current.isOwnable && !current.isOwned()) || displayedTile !== current; 

      if (gameState.turns === 0 && gameState.turnPhase === 'before-move') {
        display = false;
      } 

      if (detail) {
        setDisplayedTile(detail);
        setShouldDisplay(display);
      } else {
        setDisplayedTile(null);
        setShouldDisplay(false);
      }
    }

    window.addEventListener('displayTitle', ondisplayTitle as EventListener);
    return () => window.removeEventListener('displayTitle', ondisplayTitle as EventListener);
  }, []);

  return (
    <div className="current-tile">
      {!!shouldDisplay && (
        <TileCard tile={displayedTile ?? current} mode="display" gameState={gameState} />
      )}
    </div>
  );
};
