import React from 'react';
import GameModal from './GameModal';
import { DecoratedButton } from './DecoratedButton';
import { SayLevel } from '../utils/say';
import '../styles/modal.css';

export interface LogMessage {
  message: string;
  level: SayLevel;
  timestamp: number;
}

interface GameLogModalProps {
  messages: LogMessage[];
  onClose: () => void;
}

const GameLogModal: React.FC<GameLogModalProps> = ({ messages, onClose }) => {
  const getColor = (level: SayLevel) => {
    switch (level) {
      case 'error':
        return '#d32f2f';
      case 'warning':
        return '#f57c00';
      case 'success':
        return '#388e3c';
      case 'info':
        return '#1976d2';
      default:
        return '#333';
    }
  };

  return (
    <GameModal className="game-modal">
      <div
        className="modal-content"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', minWidth: '300px' }}
      >
        <h2>Game Log</h2>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            textAlign: 'left',
            padding: '10px',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '4px',
            marginBottom: '10px',
            minHeight: '200px',
          }}
        >
          {messages.length === 0 && <p>No messages yet.</p>}
          {messages
            .slice()
            .reverse()
            .map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: '8px',
                  borderBottom: '1px solid #ccc',
                  paddingBottom: '4px',
                }}
              >
                <span
                  style={{
                    color: getColor(msg.level),
                    fontWeight: msg.level === 'error' ? 'bold' : 'normal',
                  }}
                >
                  {msg.message}
                </span>
              </div>
            ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DecoratedButton onClick={onClose}>Close</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default GameLogModal;
