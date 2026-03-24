import React from 'react';
import { PlayerSetup } from '../utils/playerSetup';

type NewGameButtonProps = {
  onClick: (playersSetup: PlayerSetup[]) => void;
};

const NewGameButton: React.FC<NewGameButtonProps> = ({ onClick: _onClick }) => {
  function handleReset() {
    if (
      window.confirm(
        'Are you sure you want to start a new game? Your current progress will be lost.'
      )
    ) {
      try {
        localStorage.removeItem('game-state');
      } catch (e) {
        // ignore storage errors
      } finally {
        window.location.reload();
      }
    }
  }

  return (
    <div className="shield-button-container">
      <button onClick={handleReset} className="shield-button">
        🐲
      </button>
    </div>
  );
};

export default NewGameButton;
