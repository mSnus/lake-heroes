import React from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { say } from '../utils/say';
import { PlayerLabel } from './PlayerLabel';
import { computeAnnualReward } from '../game/kingsGrace';
import { getArtifact } from '../game/artifacts';
import { SquadDisplay } from './SquadDisplay';
import { getOverrides } from '../utils/overridesStore';
import { gameEvent } from '../utils/events';
import { handleKingCastle } from '../actions/king';
import { openTavernHireOnly } from '../actions/tavern';
import { useT } from '../i18n';

interface CurrentPlayerProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const activePlayer = gameState.activePlayer;

  // The active tile's name is always clickable, but King's Castle and the
  // Tavern get their own dialogue back (mirrors clicking the tile itself on
  // the board) instead of the generic read-only tile card.
  const handleTileNameClick = () => {
    if (gameState.activeTile.id === 'king-castle') {
      handleKingCastle(gameState, updateGameState);
    } else if (gameState.activeTile.id === 'tavern') {
      openTavernHireOnly(gameState, updateGameState);
    } else {
      gameEvent('displayTile', gameState.activeTile);
    }
  };

  const { kingsGold, kingsUnits, arifactGold, totalGold, totalUnits } =
    computeAnnualReward(activePlayer);

  return (
    <div className="player-pane-wrapper">
      <div className="current-player">
        <PlayerLabel player={activePlayer} />
        
        <span>{t('currentPlayer.isAt')}</span>
        <span
          style={{ color: gameState.activeTile.groupTextColor, cursor: 'pointer' }}
          onClick={handleTileNameClick}
        >
          {gameState.activeTile.name}{' '}
        </span>
      </div>

      <div className="player-pane">
        {(gameState.kingsContracts.some((c) => c.playerId === activePlayer.id) ||
          activePlayer.artifacts.length > 0) && (
          <div className="player-stats-contracts">
            {gameState.kingsContracts
              .filter((c) => c.playerId === activePlayer.id)
              .map((c) => {
                const tile = gameState.tiles[c.tilePosition];
                if (!tile) return null;
                return (
                  <span
                    key={c.tilePosition}
                    className="player-contract-badge"
                    onClick={() =>
                      say(
                        t('currentPlayer.kingsContractTooltip', {
                          tileName: tile.name,
                          award: c.award,
                        }),
                        'info'
                      )
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="icon">📜</span> {tile.name}
                  </span>
                );
              })}
            {activePlayer.artifacts.map((id) => {
              const artifact = getArtifact(id);
              if (!artifact) return null;
              return (
                <span
                  key={`artifact-${id}`}
                  className="player-artifact-badge"
                  onClick={() =>
                    say(
                      t('currentPlayer.artifactTooltip', {
                        name: artifact.name,
                        description: artifact.description,
                      }),
                      'info'
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <span className="icon">{artifact.emoji}</span> {artifact.name}
                </span>
              );
            })}
          </div>
        )}
        <div className="player-stats-gold">
          {/* wealth */}
          <div
            className="player-stats-data"
            id="statsOwnedResources"
            onClick={() => say(t('currentPlayer.goldTooltip'), 'info')}
          >
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              👛
            </div>
            <div>
              <strong>{activePlayer.gold ?? 0}🟡</strong>
            </div>
          </div>
          
          {/* fame */}        
          <div
            className="player-stats-data"
            id="statsFame"
            onClick={() => say(t('currentPlayer.fameTooltip'), 'info')}
            style={{ cursor: 'pointer' }}
          >
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              🏆
            </div>
            <div>
              <strong>{activePlayer.fame ?? 1}</strong>
            </div>
          </div>
          {/* wages per year */}
          <div
            className="player-stats-data"
            id="statsPerTurn"
            onClick={() => {
              const fmt = (gold: number, units: number, label: string) => {
                const items = [
                  gold > 0 ? `${gold}🟡` : null,
                  units > 0 ? `${units}🧍` : null,
                ].filter(Boolean);
                return items.length > 0 ? `${items.join(` ${t('common.and')} `)} ${label}` : null;
              };
              const parts = [
                fmt(kingsGold, kingsUnits, t('currentPlayer.asKingsGrace')),
                fmt(arifactGold, 0, t('currentPlayer.fromPristineDiamond')),
              ].filter(Boolean);
              say(
                t('currentPlayer.wagesMessage', {
                  detail: parts.length ? ': ' + parts.join(', ') : '',
                }),
                'info'
              );
            }}
          >
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              🏰
            </div>
            <div>
              {totalGold > 0 && <strong>+{totalGold}🟡</strong>}
              {totalUnits > 0 && <strong>+{totalUnits} 👬</strong>}
            </div>
          </div>
        </div>
        {/* army, broken down slot by slot — spans the whole row */}
        <div
          className="player-stats-data player-stats-army-cell"
          id="statsArmy"
          onClick={() =>
            say(
              t('currentPlayer.armyTooltip', {
                fame: activePlayer.fame,
                slots: activePlayer.armySlots,
                perSlot: getOverrides().garrisonCapacity,
              }),
              'info'
            )
          }
        >
          <div
            className="player-stats-hint"
            style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
          >
            ⚔️
          </div>
          <SquadDisplay
            militia={activePlayer.militia}
            riders={activePlayer.riders}
            totalSlots={activePlayer.armySlots}
            className="player-stats-army-slots"
          />
        </div>
      </div>
    </div>
  );
};
