import React from 'react';

import shield from '../../public/assets/shield.png';

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
    <div
      style={{
        position: 'fixed',
        top: '-18px',
        left: '-18px',
        width: '80px',
        height: '80px',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 50,
        backgroundImage: `url(${shield})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'contain',
        filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))',
      }}
    >
      <button
        onClick={handleReset}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '100%',
          fontSize: '12px',
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          color: '#b1a772',
          fontWeight: 600,
        }}
      >
        New
        <br />
        Game
      </button>
    </div>
  );
};

export default NewGameButton;
