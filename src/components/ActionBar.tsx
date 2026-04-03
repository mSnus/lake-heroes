import React from 'react';
import { GameState } from '../game/GameState';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { CurrentPlayer } from './CurrentPlayer';
import '../styles/ActionBar.css';

interface ActionBarProps {
  gameState: GameState | null;
  updateGameState: (gs: GameState) => void;
  onOpenLog: () => void;
  onNewGame: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  gameState,
  updateGameState,
  onOpenLog,
  onNewGame,
}) => {
  const { active: diceActive } = useModal();
  const endTurnReady = useEndTurnReady();
  const canEndTurn = endTurnReady && !diceActive;

  function handleNewGame() {
    if (
      window.confirm('Are you sure you want to start a new game? Your current progress will be lost.')
    ) {
      try {
        localStorage.removeItem('game-state');
        onNewGame();
      } catch {
        // ignore storage errors
      } finally {
        window.location.reload();
      }
    }
  }

  function handleEndTurn() {
    if (!gameState || !canEndTurn) return;
    gameEvent('setPhase', 'before-move');
    endTurn(gameState, updateGameState);
  }

  return (
    <>
      <div className="action-bar-corner action-bar-corner--left" title="New Game">
        <div className="shield-button-container">
          <button onClick={handleNewGame} className="shield-button">
            🐲
          </button>
        </div>
      </div>
      <div
        className="action-bar"
        style={{
          borderColor: gameState?.activePlayer.color ?? '#eeeeee',
          borderTopStyle: 'solid',
          borderTopWidth: '4px',
        }}
      >
        {gameState && <CurrentPlayer gameState={gameState} />}

        {canEndTurn && (
          <div className="shield-button-container main-button" title="End Turn">
            <button onClick={handleEndTurn} className="shield-button">
              ⏳
            </button>
          </div>
        )}
        {diceActive && (
          <div className="shield-button-container main-button" title="Roll Dice">
            <button onClick={startDiceRoll} className="shield-button">
              🎲
            </button>
          </div>
        )}
      </div>
    </>
  );
};
