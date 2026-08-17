import React, { useEffect } from 'react';
import { GameState } from '../game/GameState';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { useScreen } from '../utils/screenStore';
import { CurrentPlayer } from './CurrentPlayer';
import '../styles/ActionBar.css';

interface ActionBarProps {
  gameState: GameState | null;
  updateGameState: (gs: GameState) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ gameState, updateGameState }) => {
  const { active: diceActive } = useModal();
  const endTurnReady = useEndTurnReady();
  // A fullscreen overlay (battle, dragon challenge, guards, …) owns its own
  // controls, so Space must not end the turn behind it.
  const screenActive = !!useScreen();
  const canEndTurn = endTurnReady && !diceActive && !screenActive;
  const isBotTurn = !!gameState?.activePlayer.isComputer;

  useEffect(() => {
    if (isBotTurn || (!diceActive && !canEndTurn)) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (diceActive) {
          startDiceRoll();
        } else if (canEndTurn && gameState) {
          gameEvent('setPhase', 'before-move');
          gameEvent('displayTile', {});
          endTurn(gameState, updateGameState);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isBotTurn, diceActive, canEndTurn, gameState, updateGameState]);

  return (
    <div
      className="action-bar"
      style={{
        borderColor: gameState?.activePlayer.color ?? '#eeeeee',
        borderTopStyle: 'solid',
        borderTopWidth: '4px',
      }}
    >
      {gameState && <CurrentPlayer gameState={gameState} updateGameState={updateGameState} />}
    </div>
  );
};
