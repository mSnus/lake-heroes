import React from 'react';

import shield from '/assets/shield.png';

const NewGameButton: React.FC = () => {
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
