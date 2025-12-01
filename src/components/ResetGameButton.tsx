import React from 'react';

const ResetGameButton: React.FC = () => {
  function handleReset() {
    if (window.confirm('Are you sure you want to start a new game? Your current progress will be lost.')) {
      try {
        localStorage.removeItem('board-state');
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
        bottom: 0,
        left: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 0',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <button
        onClick={handleReset}
        style={{
          padding: '10px 16px',
          borderRadius: 6,
          border: '1px solid #ccc',
          cursor: 'pointer',
          background: '#fff',
          color: '#333',
          fontWeight: 600,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        New Game
      </button>
    </div>
  );
};

export default ResetGameButton;
