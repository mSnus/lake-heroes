import React from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { say } from '../utils/say';
import { PlayerLabel } from './PlayerLabel';
import { computeKingsGraceReward } from '../game/kingsGrace';
import { getArtifact } from '../game/artifacts';
import { SquadDisplay } from './SquadDisplay';
import { getOverrides } from '../utils/overridesStore';
import { gameEvent } from '../utils/events';
import { useT } from '../i18n';

interface CurrentPlayerProps {
  gameState: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState }) => {
  const t = useT();
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
            say(t('currentPlayer.fameTooltip'), 'info')
          }
          style={{ cursor: 'pointer' }}
        >
          <div></div>
          <div>
            <strong>🏆 {activePlayer.fame ?? 1}</strong>
          </div>
        </div>

        <span>{t('currentPlayer.isAt')}</span>
        <span
          style={{ color: gameState.activeTile.groupTextColor, cursor: 'pointer' }}
          onClick={() => gameEvent('displayTile', gameState.activeTile)}
        >
          {gameState.activeTile.name}{' '}
        </span>
      </div>

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
                    say(t('currentPlayer.kingsContractTooltip', { tileName: tile.name, award: c.award }), 'info')
                  }
                  style={{ cursor: 'pointer' }}
                >
                  📜 {tile.name}
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
                onClick={() => say(t('currentPlayer.artifactTooltip', { name: artifact.name, description: artifact.description }), 'info')}
                style={{ cursor: 'pointer' }}
              >
                {artifact.emoji}
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

        {/* wages per year */}
        <div
          className="player-stats-data"
          id="statsPerTurn"
          onClick={() => {
            const fmt = (gold: number, units: number, label: string) => {
              const items = [gold > 0 ? `${gold}🟡` : null, units > 0 ? `${units}🧍` : null].filter(
                Boolean
              );
              return items.length > 0 ? `${items.join(` ${t('common.and')} `)} ${label}` : null;
            };

            const parts = [
              fmt(tileGold, tileUnits, t('currentPlayer.fromYourTiles')),
              fmt(kingsGold, kingsUnits, t('currentPlayer.asKingsGrace')),
              fmt(diamondGold, 0, t('currentPlayer.fromPristineDiamond')),
            ].filter(Boolean);

            say(
              t('currentPlayer.wagesMessage', { detail: parts.length ? ': ' + parts.join(', ') : '' }),
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
