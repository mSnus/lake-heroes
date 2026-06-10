import React, { useMemo } from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { Tile } from '../game/Tile';
import { MONEY_PASS_START } from './board/common';
import { say } from '../utils/say';
import { PlayerLabel } from './PlayerLabel';

interface CurrentPlayerProps {
  gameState: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState }) => {
  const activePlayer = gameState.activePlayer;

  // Map owned tiles and keep their indices
  const owned = useMemo(() => {
    const res: { tile: Tile; idx: number }[] = [];
    gameState.tiles.forEach((t: any, idx: number) => {
      if (t && t.owner === activePlayer.id) res.push({ tile: t as Tile, idx });
    });
    return res;
  }, [gameState, activePlayer.name]);

  let totalGold = 0;
  let totalUnits = activePlayer.fame ?? 1;

  owned.forEach(({ tile }) => {
    if (tile.bonusType === 'gold') {
      totalGold += tile.bonuses[tile.level] ?? 0;
    } else {
      totalUnits += tile.bonuses[tile.level] ?? 0;
    }
  });

  totalGold += MONEY_PASS_START;

  return (
    <div className="player-pane">
      <div
        style={{
          fontWeight: 600,
          paddingBottom: '4px',
          paddingTop: '4px',
          gap: '8px',
          textAlign: 'center',
        }}
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
        <span style={{ color: gameState.activeTile.groupColor }}>{gameState.activeTile.name} </span>
      </div>

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
            const kingsGold = MONEY_PASS_START;
            const kingsUnits = activePlayer.fame ?? 1;
            const tileGold = totalGold - kingsGold;
            const tileUnits = totalUnits - kingsUnits;

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
