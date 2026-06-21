import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { showScreen } from '../utils/screenStore';
import { useShakeToRoll, requestShakeToRollPermission } from '../utils/useShakeToRoll';
import HelpScreen from './HelpScreen';

interface ShieldColumnProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
  onOpenLog: () => void;
}

export const ShieldColumn: React.FC<ShieldColumnProps> = ({
  gameState,
  updateGameState,
  onOpenLog,
}) => {
  const { active: diceActive, rolling } = useModal();
  const endTurnReady = useEndTurnReady();
  const canEndTurn = endTurnReady && !diceActive;
  const [menuOpen, setMenuOpen] = useState(false);

  // Covers movement rolls and the Tavern/Sphynx/Treasure dice prompts, since
  // they all funnel through the same diceStore (active && !rolling).
  useShakeToRoll(diceActive && !rolling, startDiceRoll);

  function handleNewGame() {
    setMenuOpen(false);
    if (
      window.confirm(
        'Are you sure you want to start a new game? Your current progress will be lost.'
      )
    ) {
      try {
        localStorage.removeItem('game-state');
      } catch {
        // ignore
      } finally {
        window.location.reload();
      }
    }
  }

  function handleEndTurn() {
    if (!canEndTurn) return;
    gameEvent('setPhase', 'before-move');
    gameEvent('displayTile', {});
    endTurn(gameState, updateGameState);
  }

  const colStyle: React.CSSProperties = {
    position: 'absolute',
    right: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 1010,
  };

  return (
    <>
      <div style={{ ...colStyle, top: 8 }}>
        <div className="shield-button-container" title="Menu">
          <button onClick={() => setMenuOpen((o) => !o)} className="shield-button">
            🐲
          </button>
        </div>
        {menuOpen && (
          <>
            <div className="shield-button-container" title="New Game">
              <button onClick={handleNewGame} className="shield-button">
                🏆
              </button>
            </div>
            <div className="shield-button-container" title="Help">
              <button
                onClick={() => { setMenuOpen(false); showScreen({ content: <HelpScreen /> }); }}
                className="shield-button"
              >
                ?
              </button>
            </div>
            <div className="shield-button-container" title="Game Log">
              <button onClick={() => { setMenuOpen(false); onOpenLog(); }} className="shield-button">
                📜
              </button>
            </div>
            <div className="shield-button-container" title="Enable Shake to Roll">
              <button
                onClick={() => { setMenuOpen(false); requestShakeToRollPermission(); }}
                className="shield-button"
              >
                📳
              </button>
            </div>
            <div className="shield-button-container" title="Reload">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigator.serviceWorker?.getRegistrations().then((regs) =>
                    Promise.all(regs.map((r) => r.update()))
                  ).finally(() => window.location.reload());
                }}
                className="shield-button"
              >
                🔄
              </button>
            </div>
          </>
        )}
      </div>

      {(diceActive || canEndTurn) && (
        <div style={{ ...colStyle, bottom: '60px' }}>
          {diceActive && (
            <div className="shield-button-container main-button" title="Roll Dice">
              <button onClick={startDiceRoll} className="shield-button">
                🎲
              </button>
            </div>
          )}
          {canEndTurn && (
            <div className="shield-button-container main-button" title="End Turn">
              <button onClick={handleEndTurn} className="shield-button">
                ⏳
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
