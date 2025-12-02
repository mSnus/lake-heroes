import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';

interface Props {
  board: GameState | null;
  updateGameState: (board: GameState) => void;
}

export const DiceWidget: React.FC<Props> = ({ board, updateGameState }) => {
  const [side, setSide] = useState<number>(1);
  const [reRoll, setReRoll] = useState(false);
  const animationTimeout = useRef<number | null>(null);


  useEffect(() => {
    function onDiceRolled(e: Event) {
      const detail = (e as CustomEvent).detail;
      const value = typeof detail === 'number' ? detail : 1;
      setReRoll(true);

      setSide(value);

      if (animationTimeout.current) window.clearTimeout(animationTimeout.current);
      animationTimeout.current = window.setTimeout(() => {
        setReRoll(false);
        // hide dice after animation by mutating board.dice.visible and committing
        if (board && board.dice) {
          board.dice.visible = false;
          updateGameState(board);
        }
        // notify that dice animation stopped
        window.dispatchEvent(new CustomEvent('diceAnimationStopped', { detail: value }));
      }, 1600) as unknown as number;
    }

    window.addEventListener('diceRolled', onDiceRolled as EventListener);
    return () => window.removeEventListener('diceRolled', onDiceRolled as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  useEffect(() => {
    function onStart() {
      if (!board) return;
      // Show dice in UI then trigger roll via board.dice
      if (board.dice) {
        board.dice.visible = true;
        updateGameState(board);
        board.dice.roll();
      } else {
        const d = new Dice();
        d.visible = true;
        if (board) {
          (board as any).dice = d;
          updateGameState(board);
          d.roll();
        }
      }
    }
    window.addEventListener('startDiceRoll', onStart as EventListener);
    return () => window.removeEventListener('startDiceRoll', onStart as EventListener);
  }, [board]); // depends on board to access dice instance


  if (!board || !board.dice || !board.dice.visible) return null;

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000 }}>
      <div
        id="dice"
        data-side={String(side)}
        className={reRoll ? 'reRoll' : ''}
        style={{ width: 90, height: 90, transformStyle: 'preserve-3d' }}
      >
        <div className="sides side-1">
          <span className="dot dot-1" />
        </div>
        <div className="sides side-2">
          <span className="dot dot-1" />
          <span className="dot dot-2" />
        </div>
        <div className="sides side-3">
          <span className="dot dot-1" />
          <span className="dot dot-2" />
          <span className="dot dot-3" />
        </div>
        <div className="sides side-4">
          <span className="dot dot-1" />
          <span className="dot dot-2" />
          <span className="dot dot-3" />
          <span className="dot dot-4" />
        </div>
        <div className="sides side-5">
          <span className="dot dot-1" />
          <span className="dot dot-2" />
          <span className="dot dot-3" />
          <span className="dot dot-4" />
          <span className="dot dot-5" />
        </div>
        <div className="sides side-6">
          <span className="dot dot-1" />
          <span className="dot dot-2" />
          <span className="dot dot-3" />
          <span className="dot dot-4" />
          <span className="dot dot-5" />
          <span className="dot dot-6" />
        </div>
      </div>
    </div>
  );
};
