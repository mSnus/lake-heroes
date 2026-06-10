import React, { useState, useEffect } from 'react';
import { Player } from '../game/Player';
import { PlayerCard } from './PlayerCard';
import { PlayerStats } from './PlayerStats';
import '../styles/CurrentPlayerCard.css';

/**
 * Floating card shown when a player icon on the board is clicked (mirrors
 * CurrentTile). Listens for the `displayPlayer` event; click the card to close.
 */
export const CurrentPlayerCard: React.FC = () => {
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    function onDisplayPlayer(e: Event) {
      const detail = (e as CustomEvent).detail as Player | null;
      setPlayer(detail && detail.name ? detail : null);
    }
    // Showing a tile hides the player card (the two cards are mutually exclusive).
    function onDisplayTile(e: Event) {
      const detail = (e as CustomEvent).detail as { name?: string } | null;
      if (detail && detail.name) setPlayer(null);
    }
    window.addEventListener('displayPlayer', onDisplayPlayer as EventListener);
    window.addEventListener('displayTile', onDisplayTile as EventListener);
    return () => {
      window.removeEventListener('displayPlayer', onDisplayPlayer as EventListener);
      window.removeEventListener('displayTile', onDisplayTile as EventListener);
    };
  }, []);

  if (!player) return null;

  return (
    <div className="current-player-card-wrapper" onClick={() => setPlayer(null)}>
      <div className="current-player-card">
        <PlayerCard player={player} />
        <PlayerStats player={player} />
      </div>
    </div>
  );
};

export default CurrentPlayerCard;
