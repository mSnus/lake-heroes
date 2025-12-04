import React from 'react';
import { GameState } from '../game/GameState';
import '../styles/CurrentPlayer.css';

interface CurrentPlayerProps {
  gameState: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState }) => {
  const activePlayer = gameState.activePlayer;
  return (
    <div className="player-pane">
      <div
        style={{
          fontWeight: 500,
          borderColor: activePlayer.color,
          borderBottomStyle: 'solid',
          borderBottomWidth: '4px',
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
    </div>
  );
};
