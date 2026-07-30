import React from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { say } from '../utils/say';
import { PlayerLabel } from './PlayerLabel';
import { computeKingsGraceReward } from '../game/kingsGrace';
import { getArtifact } from '../game/artifacts';
import { SquadDisplay } from './SquadDisplay';

interface CurrentPlayerProps {
  gameState: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState }) => {
  const activePlayer = gameState.activePlayer;

  const { tileGold, tileUnits, kingsGold, kingsUnits, diamondGold, totalGold, totalUnits } =
    computeKingsGraceReward(gameState, activePlayer);

  return (
    <div className="player-pane">
      <div className="current-player">
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
        <span style={{ color: gameState.activeTile.groupTextColor }}>
          {gameState.activeTile.name}{' '}
        </span>
      </div>

      {gameState.kingsContracts.some((c) => c.playerId === activePlayer.id) && (
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
                    say(`King's contract: claim ${tile.name} for ${c.award}🟡!`, 'info')
                  }
                  style={{ cursor: 'pointer' }}
                >
                  📜 {tile.name}
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
          onClick={() => say('Current gold you own', 'info')}
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
              fmt(diamondGold, 0, 'from the Pristine Diamond 💎'),
            ].filter(Boolean);

            say(
              `Your wages after passing the King's Castle${parts.length ? ': ' + parts.join(', ') : ''}`,
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

        {/* army, broken down slot by slot */}
        <div
          className="player-stats-data"
          id="statsArmy"
          onClick={() =>
            say(
              `Your army: ${activePlayer.slotsUsed}/${activePlayer.armySlots} slots used, each holding up to 10 of one kind`,
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

        {/* player's artifacts — the whole cell is skipped when there are none */}
        {activePlayer.artifacts.length > 0 && (
          <div className="player-stats-data" id="statsArtifacts">
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              💎
            </div>
            <div className="player-stats-artifacts">
              {activePlayer.artifacts.map((id) => {
                const artifact = getArtifact(id);
                if (!artifact) return null;
                return (
                  <span
                    key={id}
                    className="player-artifact-badge"
                    onClick={() => say(`${artifact.name}: ${artifact.description}`, 'info')}
                    style={{ cursor: 'pointer' }}
                  >
                    {artifact.emoji}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
