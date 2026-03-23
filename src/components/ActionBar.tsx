import React from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useModal, startDiceRoll } from '../utils/modalStore';
import '../styles/ActionBar.css';

interface ActionBarProps {
  gameState: GameState | null;
  menu: MenuState | null;
  updateGameState: (gs: GameState) => void;
  setMenu: (menu: MenuState) => void;
  onOpenLog: () => void;
  onNewGame: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  gameState,
  menu,
  updateGameState,
  setMenu,
  onOpenLog,
  onNewGame,
}) => {
  const { type: modalType } = useModal();
  const canEndTurn = menu?.type === 'end-turn' && modalType !== 'dice';
  const canRollDice = modalType === 'dice';

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
    endTurn(gameState, updateGameState, setMenu);
  }

  return (
    <div className="action-bar">
      <div className="shield-button-container" title="New Game">
        <button onClick={handleNewGame} className="shield-button">
          🐲
        </button>
      </div>
      <div className="shield-button-container" title="Game Log">
        <button onClick={onOpenLog} className="shield-button">
          📜
        </button>
      </div>
      <div
        className={`shield-button-container${canEndTurn ? '' : ' shield-button-container--disabled'}`}
        title="End Turn"
      >
        <button onClick={handleEndTurn} className="shield-button" disabled={!canEndTurn}>
          ⏳
        </button>
      </div>
      {canRollDice && (
        <div className="shield-button-container" title="Roll Dice">
          <button onClick={startDiceRoll} className="shield-button">
            🎲
          </button>
        </div>
      )}
    </div>
  );
};
