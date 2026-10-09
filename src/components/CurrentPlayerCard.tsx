import React, { useState, useEffect } from 'react';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { computeAnnualReward } from '../game/kingsGrace';
import { useModal } from '../utils/diceStore';
import { PlayerCard } from './PlayerCard';
import { PlayerStats } from './PlayerStats';
import { TILE_COUNT } from '../game/constants';
import { gameEvent } from '../utils/events';
import { sayLocal } from '../utils/say';
import { useT } from '../i18n';
import '../styles/CurrentPlayerCard.css';

interface CurrentPlayerCardProps {
  gameState: GameState;
}

/**
 * Floating card shown when a player icon on the board is clicked (mirrors
 * CurrentTile). Listens for the `displayPlayer` event; click the card to close.
 */
export const CurrentPlayerCard: React.FC<CurrentPlayerCardProps> = ({ gameState }) => {
  const t = useT();
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

  const currentTile = gameState.tiles[player.position % TILE_COUNT];
  const { totalGold, totalUnits } = computeAnnualReward(gameState, player);
  const contracts = gameState.kingsContracts.filter((c) => c.playerId === player.id);

  return (
    <div className="current-player-card-wrapper game-modal-border" onClick={() => setPlayer(null)}>
      <div className="current-player-card">
        <PlayerCard
          player={player}
          prefix={player.karma < 0 ? '🕷️' : undefined}
          extraBadges={contracts.map((c) => {
            const tile = gameState.tiles[c.tilePosition];
            if (!tile) return null;
            return (
              <span
                key={`contract-${c.tilePosition}`}
                className="cpc-contract-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  sayLocal(
                    t('currentPlayer.kingsContractTooltip', { tileName: tile.name, award: c.award }),
                    'info'
                  );
                }}
              >
                📜 {tile.shortName}
              </span>
            );
          })}
        />
        {currentTile && (
          <div className="cpc-is-at">
            {t('currentPlayer.isAt')}{' '}
            <span
              style={{ color: currentTile.groupTextColor, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                gameEvent('displayTile', currentTile);
              }}
            >
              {currentTile.name}
            </span>
          </div>
        )}
        <PlayerStats player={player} income={{ gold: totalGold, units: totalUnits }} />
        {ownedTiles.length > 0 && (
          <div className="cpc-owned-tiles">
            {ownedTiles.map((tile) => (
              <span key={tile.name} className="cpc-tile-name" style={{ color: tile.groupTextColor }}>
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
