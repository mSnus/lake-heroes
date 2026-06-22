import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import { TileCard } from './TileCard';
import { Tile } from '../game/Tile';
import { PlayerLabel } from './PlayerLabel';
import { gameEvent } from '../utils/events';

interface CurrentTileProps {
  gameState: GameState;
  updateGameState: (board: any) => void;
}

export const CurrentTile: React.FC<CurrentTileProps> = ({ gameState, updateGameState }) => {
  const [displayedTile, setDisplayedTile] = useState<Tile | null>(null);
  const [shouldDisplay, setShouldDisplay] = useState<boolean>(true);
  // Hidden while the player card is shown (the two cards are mutually exclusive).
  const [playerShown, setPlayerShown] = useState<boolean>(false);

  const currentTile = gameState.activeTile;

  React.useEffect(() => {
    function onDisplayTile(e: Event) {
      const detail = (e as CustomEvent).detail as Tile | null;

      setPlayerShown(false);
      if (detail && detail.name) {
        setDisplayedTile(detail);
        setShouldDisplay(true);
      } else {
        setDisplayedTile(null);
        setShouldDisplay(false);
      }
    }

    function onDisplayPlayer(e: Event) {
      const detail = (e as CustomEvent).detail as { name?: string } | null;
      if (detail && detail.name) setPlayerShown(true);
    }

    window.addEventListener('displayTile', onDisplayTile as EventListener);
    window.addEventListener('displayPlayer', onDisplayPlayer as EventListener);
    return () => {
      window.removeEventListener('displayTile', onDisplayTile as EventListener);
      window.removeEventListener('displayPlayer', onDisplayPlayer as EventListener);
    };
  }, []);

  // Buy is only offered for the active tile (where the active player stands),
  // never for a different tile the player clicked to inspect.
  const showingActiveTile = displayedTile === null || displayedTile === currentTile;
  const couldBuy =
    showingActiveTile &&
    currentTile.isOwnable &&
    !currentTile.isOwned() &&
    !gameState.activePlayer.hasClaimedThisTurn &&
    gameState.turnPhase === 'after-move';

  // label: `Buy for ${currentTile.prices['1']?.gold ?? 0} 🟡 ${currentTile.prices['1']?.units ?? 0} 🧍`,
  //   onClick: () => buyTile(board, updateGameState),

  const isVisible =
    !playerShown &&
    ((shouldDisplay && (displayedTile !== null || gameState.turnPhase !== 'before-move')) ||
      (gameState.turnPhase === 'before-move' && currentTile.isOwnable && !currentTile.isOwned()));
  // A turn-phase change lets the tile card reclaim the spotlight from a
  // lingering player card.
  React.useEffect(() => {
    setPlayerShown(false);
  }, [gameState.turnPhase]);

  // The tile card and player card are mutually exclusive: whenever the tile
  // card becomes visible (including phase-driven auto-shows that emit no event),
  // dismiss the player card.
  React.useEffect(() => {
    if (isVisible) gameEvent('displayPlayer', {});
  }, [isVisible]);

  const shownTile = isVisible ? (displayedTile ?? currentTile) : null;
  const ownerPlayer = shownTile?.owner
    ? gameState.players.find((p) => p.id === shownTile.owner)
    : undefined;
  const ownerColor = ownerPlayer?.color;

  return (
    <div className="current-tile-card-wrapper">
      {ownerPlayer && ownerColor && (
        <div className="tile-card-owner-info">
          <div className="tile-owner">
            🚩 owned by <PlayerLabel player={ownerPlayer} />
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
