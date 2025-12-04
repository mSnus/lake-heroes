import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { Dice } from '../game/Dice';

interface Props {
  gameState: GameState | null;
}

export const DiceWidget: React.FC<Props> = ({ gameState }) => {
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
        // hide dice after animation by mutating gameState.dice.visible and committing
        if (gameState && gameState.dice) {
          gameState.dice.visible = false;
        }
        // notify that dice animation stopped
        window.dispatchEvent(new CustomEvent('diceAnimationStopped', { detail: value }));
      }, 1600) as unknown as number;
    }

    window.addEventListener('diceRolled', onDiceRolled as EventListener);
    return () => window.removeEventListener('diceRolled', onDiceRolled as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  useEffect(() => {
    function onStart() {
      if (!gameState) return;
      // Show dice in UI then trigger roll via gameState.dice
      if (gameState.dice) {
        gameState.dice.visible = true;
        gameState.dice.roll();
      } else {
        const d = new Dice();
        d.visible = true;
        if (gameState) {
          (gameState as any).dice = d;
          d.roll();
        }
      }
    }
    window.addEventListener('startDiceRoll', onStart as EventListener);
    return () => window.removeEventListener('startDiceRoll', onStart as EventListener);
  }, [gameState]); // depends on gameState to access dice instance


  if (!gameState || !gameState.dice || !gameState.dice.visible) return null;

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
