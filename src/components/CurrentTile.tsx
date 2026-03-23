import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import { TileCard } from './TileCard';
import { Tile } from '../game/Tile';

interface CurrentTileProps {
  gameState: GameState;
  updateGameState: (board: any) => void;
}

export const CurrentTile: React.FC<CurrentTileProps> = ({ gameState, updateGameState }) => {
  const [displayedTile, setDisplayedTile] = useState<Tile | null>(null);
  const [shouldDisplay, setShouldDisplay] = useState<boolean>(true);

  const currentTile = gameState.activeTile;
  const activePlayer = gameState.activePlayer;

  if (gameState.turnPhase === 'before-move' && shouldDisplay) {
    setShouldDisplay(false);
  }
  React.useEffect(() => {
    function ondisplayTitle(e: Event) {
      const detail = (e as CustomEvent).detail;
      let display =
        (detail !== null && currentTile.isOwnable && !currentTile.isOwned()) || displayedTile !== currentTile;

      if (gameState.turnPhase === 'before-move') {
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

  const couldBuy = currentTile.isOwnable && !currentTile.isOwned();
  const couldAfford = currentTile.isAffordable(activePlayer.gold, activePlayer.units);

  // label: `Buy for ${currentTile.prices['1']?.gold ?? 0} 🟡 ${currentTile.prices['1']?.units ?? 0} 🧍`,
  //   onClick: () => buyTile(board, updateGameState),

  return (
    <div className="current-tile">
      {shouldDisplay && (
        <TileCard
          tile={displayedTile ?? currentTile}
          mode="display"
          gameState={gameState}
          updateGameState={updateGameState}
          couldBuy={couldBuy}
          couldAfford={couldAfford}
        />
      )}
    </div>
  );
};
