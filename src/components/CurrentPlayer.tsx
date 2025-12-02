import React from 'react';
import { GameState } from '../game/GameState';
import { isMobileLayout } from './board/common';
import '../styles/CurrentPlayer.css';

interface CurrentPlayerProps {
  board: GameState;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ board }) => {
  const activePlayer = board.activePlayer;

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
