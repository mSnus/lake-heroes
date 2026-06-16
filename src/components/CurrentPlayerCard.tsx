import React, { useState, useEffect } from 'react';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { playerIncome } from '../game/income';
import { useModal } from '../utils/diceStore';
import { PlayerCard } from './PlayerCard';
import { PlayerStats } from './PlayerStats';
import '../styles/CurrentPlayerCard.css';

interface CurrentPlayerCardProps {
  gameState: GameState;
}

/**
 * Floating card shown when a player icon on the board is clicked (mirrors
 * CurrentTile). Listens for the `displayPlayer` event; click the card to close.
 */
export const CurrentPlayerCard: React.FC<CurrentPlayerCardProps> = ({ gameState }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const { active: diceActive } = useModal();

  // A dice roll display takes over the screen — dismiss the player card.
  useEffect(() => {
    if (diceActive) setPlayer(null);
  }, [diceActive]);

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

  const ownedTiles = player.ownedTiles
    .map((idx) => gameState.tiles[idx])
    .filter(Boolean);

  return (
    <div className="current-player-card-wrapper game-modal-border" onClick={() => setPlayer(null)}>
      <div className="current-player-card">
        <PlayerCard player={player} />
        <PlayerStats player={player} income={playerIncome(gameState, player)} />
        {ownedTiles.length > 0 && (
          <div className="cpc-owned-tiles">
            {ownedTiles.map((tile) => (
              <span key={tile.name} className="cpc-tile-name" style={{ color: tile.groupColor }}>
                {tile.name.split(' ')[0]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentPlayerCard;
