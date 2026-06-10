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

  // Buy is only offered for the active tile (where the active player stands),
  // never for a different tile the player clicked to inspect.
  const showingActiveTile = displayedTile === null || displayedTile === currentTile;
  const couldBuy =
    showingActiveTile &&
    currentTile.isOwnable &&
    !currentTile.isOwned() &&
    (gameState.turnPhase === 'before-move' || gameState.turnPhase === 'after-move');

  // label: `Buy for ${currentTile.prices['1']?.gold ?? 0} 🟡 ${currentTile.prices['1']?.units ?? 0} 🧍`,
  //   onClick: () => buyTile(board, updateGameState),

  const isVisible =
    (shouldDisplay && (displayedTile !== null || gameState.turnPhase !== 'before-move')) ||
    (gameState.turnPhase === 'before-move' && currentTile.isOwnable && !currentTile.isOwned());
  const shownTile = isVisible ? (displayedTile ?? currentTile) : null;
  const ownerPlayer = shownTile?.owner
    ? gameState.players.find((p) => p.id === shownTile.owner)
    : undefined;
  const ownerColor = ownerPlayer?.color;

  return (
    <div className="current-tile-card-wrapper">
      {ownerPlayer && ownerColor && (
        <div className="tile-card-owner-info">
          <div className="tile-owner" style={{ color: ownerColor }}>
            🚩 owned by {ownerPlayer.name}
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
          />
        )}
      </div>
    </div>
  );
};
