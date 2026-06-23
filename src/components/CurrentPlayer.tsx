import React from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { say } from '../utils/say';
import { PlayerLabel } from './PlayerLabel';
import { computeKingsGraceReward } from '../game/kingsGrace';
import { getArtifact } from '../game/artifacts';

interface CurrentPlayerProps {
  gameState: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState }) => {
  const activePlayer = gameState.activePlayer;

  const { tileGold, tileUnits, kingsGold, kingsUnits, totalGold, totalUnits } =
    computeKingsGraceReward(gameState, activePlayer);

  return (
    <div className="player-pane">
      <div
        className="current-player"
      >
        <PlayerLabel player={activePlayer} />
        {/* fame */}
        <div
          className="player-stats-fame"
          id="statsFame"
          onClick={() =>
            say('Your Fame. Gain it by owning the tiles and winning the battles!', 'info')
          }
          style={{ cursor: 'pointer' }}
        >
          <div></div>
          <div>
            <strong>🏆 {activePlayer.fame ?? 1}</strong>
          </div>
        </div>
        <span>is&nbsp;at</span>
        <span style={{ color: gameState.activeTile.groupTextColor }}>{gameState.activeTile.name} </span>
      </div>

      {activePlayer.artifacts.length > 0 && (
        <div className="player-stats-artifacts">
          {activePlayer.artifacts.map((id) => {
            const artifact = getArtifact(id);
            if (!artifact) return null;
            return (
              <span key={id} className="player-artifact-badge">
                {artifact.name} {artifact.emoji}
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
          onClick={() => say('Current money and units you own', 'info')}
        >
          <div
            className="player-stats-hint"
            style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
          >
            ⚜️
          </div>
          <div></div>
          <div>
            <strong>{activePlayer.gold ?? 0} 🟡</strong>
          </div>
          <div>
            <strong>{activePlayer.units ?? 0} 🧍</strong>
          </div>
        </div>

        {/* wages per year */}
        <div
          className="player-stats-data"
          id="statsPerTurn"
          onClick={() => {
            const fmt = (gold: number, units: number, label: string) => {
              const items = [gold > 0 ? `${gold}🟡` : null, units > 0 ? `${units}🧍` : null].filter(
                Boolean
              );
              return items.length > 0 ? `${items.join(' and ')} ${label}` : null;
            };

            const parts = [
              fmt(tileGold, tileUnits, 'from your own tiles'),
              fmt(kingsGold, kingsUnits, "as the King's grace"),
            ].filter(Boolean);

            say(
              `Your wages after passing the King's Castle${parts.length ? ': ' + parts.join(', ') : ''}`,
              'info'
            );
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              🏰
            </div>

            {totalGold > 0 ? (
              <div>
                <strong>+{totalGold} 🟡</strong>
              </div>
            ) : (
              <div />
            )}
            {totalUnits > 0 ? (
              <div>
                {' '}
                <strong>+{totalUnits} 👬</strong>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
