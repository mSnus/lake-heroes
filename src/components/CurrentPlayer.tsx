import React, { useMemo } from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { Tile } from '../game/Tile';
import { MONEY_PASS_START } from './board/common';
import { say } from '../utils/say';

interface CurrentPlayerProps {
  gameState: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState }) => {
  const activePlayer = gameState.activePlayer;

  // Map owned tiles and keep their indices
  const owned = useMemo(() => {
    const res: { tile: Tile; idx: number }[] = [];
    gameState.tiles.forEach((t: any, idx: number) => {
      if (t && t.owner === activePlayer.name) res.push({ tile: t as Tile, idx });
    });
    return res;
  }, [gameState, activePlayer.name]);

  let totalGold = 0;
  let totalUnits = activePlayer.charisma ?? 1;

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
        }}
        className="current-player"
      >
        <span style={{ color: activePlayer.color }}>{activePlayer.name} </span> is at
        <span style={{ color: gameState.activeTile.groupColor }}>{gameState.activeTile.name} </span>
      </div>

      <div className="player-stats-gold">
        {/* wealth */}
        <div className="player-stats-savings" id="statsOwnedResources" onClick={() => say('Current money and units you own', 'info')} style={{ cursor: 'pointer' }}>
          <div className="player-stats-hint"></div>
          <div>
            <strong>{activePlayer.gold ?? 0} 🟡</strong>
          </div>
          <div>
            <strong>{activePlayer.units ?? 0} 🧍</strong>
          </div>
        </div>

        {/* charisma */}
        <div className="player-stats-savings" id="statsCharisma" onClick={() => say('Your Charisma. Gain it by owning the tiles and winning the battles!', 'info')} style={{ cursor: 'pointer' }}>
          <div className="player-stats-hint"></div>
          <div>
            <strong>🏆 {activePlayer.charisma ?? 1}</strong>
          </div>
        </div>

        {/* wages per turn */}
        <div className="player-stats-per-turn" id="statsPerTurn" onClick={() => say("Your wages after passing the King's Castle", 'info')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="player-stats-hint" style={{ marginRight: '8px' }}>
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
