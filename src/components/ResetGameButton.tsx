import React from 'react';

const ResetGameButton: React.FC = () => {
  function handleReset() {
    if (
      window.confirm(
        'Are you sure you want to start a new game? Your current progress will be lost.'
      )
    ) {
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
        top: '0px',
        left: '0px',
        width: '40px',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <button
        onClick={handleReset}
        style={{
          padding: '4px 6px',
          borderRadius: '0px 0px 12px 0px',
          fontSize: '12px',
          cursor: 'pointer',
          border: 'none',
          background: '#959c95ff',
          color: '#333',
          fontWeight: 600,
          boxShadow: '1px 13px 13px rgba(0,0,0,0.3)',
        }}
      >
        New Game
      </button>
    </div>
  );
};

export default ResetGameButton;
