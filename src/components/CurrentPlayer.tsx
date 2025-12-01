import React from 'react';
import { Board } from '../game/Board';
import { isMobileLayout } from './board/common';
import '../styles/CurrentPlayer.css';

interface CurrentPlayerProps {
  board: Board;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ board }) => {
  const activePlayer = board.activePlayer;

  return (
    <div className="player-pane">
      <div className="player-marker-indicator" style={{ background: activePlayer.color }} />
      <div style={{ fontWeight: 700 }}>{activePlayer.name}</div>
      <div>
        <strong>{activePlayer.gold ?? 0} 🟡</strong>
      </div>
      <div>
        <strong>{activePlayer.units ?? 0} 🧍</strong>
      </div>
    </div>
  );
};
