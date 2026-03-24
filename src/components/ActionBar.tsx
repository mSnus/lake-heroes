import React, { useMemo } from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useModal, startDiceRoll } from '../utils/modalStore';
import { CurrentPlayer } from './CurrentPlayer';
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
    <>
      <div className="action-bar-corner action-bar-corner--left" title="New Game">
        <div className="shield-button-container">
          <button onClick={handleNewGame} className="shield-button">
            🐲
          </button>
        </div>
      </div>
      <div className="action-bar-corner action-bar-corner--right" title="Game Log">
        <div className="shield-button-container">
          <button onClick={onOpenLog} className="shield-button">
            📜
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
          <div className="shield-button-container" title="End Turn">
            <button onClick={handleEndTurn} className="shield-button">
              ⏳
            </button>
          </div>
        )}
        {canRollDice && (
          <div className="shield-button-container" title="Roll Dice">
            <button onClick={startDiceRoll} className="shield-button">
              🎲
            </button>
          </div>
        )}
      </div>
    </>
  );
};
