import React, { useMemo } from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';
import { Tile } from '../game/Tile';
import { MONEY_PASS_START } from './board/common';

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
  let totalUnits = 0;

  const baseGold = MONEY_PASS_START;

  owned.forEach(({ tile }) => {
    if (tile.bonusType === 'gold') {
      totalGold += tile.bonuses[tile.level] ?? 0;
    } else {
      totalUnits += tile.bonuses[tile.level] ?? 0;
    }
  });

  totalGold += baseGold;

  return (
    <div
      className="player-pane"
      style={{
        borderColor: activePlayer.color,
        borderTopStyle: 'solid',
        borderTopWidth: '4px',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: activePlayer.color,
          paddingBottom: '4px',
          paddingTop: '4px',
        }}
      >
        {activePlayer.name}
      </div>

      <div>
        <strong>{activePlayer.gold ?? 0} 🟡</strong>
      </div>
      <div>
        <strong>{activePlayer.units ?? 0} 🧍</strong>
      </div>


      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="circular-path" style={{ marginTop: '6px', paddingRight: '4px' }}>
          🗘
        </div>
      
      
      {totalGold > 0 ? (
        <div>
          <strong>+ {totalGold} 🟡</strong>
        </div>
        ) : <div/>
      }
      
      {totalUnits > 0 ? (
        <div>
          <strong>+ {totalUnits} 👬</strong>
        </div>
        ) : <div/>
      }

      </div>
    </div>
  );
};
