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

  React.useEffect(() => {
    function onDisplayTile(e: Event) {
      const detail = (e as CustomEvent).detail as Tile | null;
      console.log('✉️ displayTile received', detail);

      if (detail && detail.name) {
        setDisplayedTile(detail);
        setShouldDisplay(true);
      } else {
        setDisplayedTile(null);
        setShouldDisplay(false);
      }
    }

    window.addEventListener('displayTile', onDisplayTile as EventListener);
    return () => window.removeEventListener('displayTile', onDisplayTile as EventListener);
  }, []);

  const couldBuy = currentTile.isOwnable && !currentTile.isOwned();
  const couldAfford = currentTile.isAffordable(activePlayer.gold, activePlayer.units);

  // label: `Buy for ${currentTile.prices['1']?.gold ?? 0} 🟡 ${currentTile.prices['1']?.units ?? 0} 🧍`,
  //   onClick: () => buyTile(board, updateGameState),

  const isVisible = shouldDisplay && (displayedTile !== null || gameState.turnPhase !== 'before-move');
  const shownTile = isVisible ? (displayedTile ?? currentTile) : null;
  const ownerColor = shownTile?.owner
    ? gameState.players.find((p) => p.name === shownTile.owner)?.color
    : undefined;

  return (
    <div className="current-tile-card-wrapper">
      {shownTile?.owner && ownerColor && (
        <div className="tile-card-owner-info">
          <div className="tile-owner" style={{ color: ownerColor }}>
              🚩 owned by {shownTile?.owner}
          </div>
        </div>
      )}
      <div
        className="current-tile"
        style={
          ownerColor
            ? { boxShadow: `0 0 0 3px ${ownerColor}, 0 2px 16px rgba(0,0,0,0.8)` }
            : undefined
        }
      >
        {isVisible && (
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
    </div>
  );
};
