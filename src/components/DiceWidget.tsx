import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/dice.css';
import { say } from '../utils/say';
import { gameEvent } from '../utils/events';
interface Props {
  gameState: GameState | null;
}

export const DiceWidget: React.FC<Props> = ({ gameState }) => {
  const [side, setSide] = useState<number>(1);
  const [needRoll, setNeedRoll] = useState<boolean>(false);

  const animationTimeout = useRef<number | null>(null);

  useEffect(() => {
    function onDiceRolled(e: Event) {
      const detail = (e as CustomEvent).detail;
      const value = typeof detail === 'number' ? detail : 1;

      if (gameState) gameState.lastDice = value;

      setSide(value);
      if (animationTimeout.current) window.clearTimeout(animationTimeout.current);
      animationTimeout.current = window.setTimeout(() => {
        gameEvent('diceAnimationStopped', value);
      }, 1600);
    }

    window.addEventListener('diceRolled', onDiceRolled as EventListener);
    return () => window.removeEventListener('diceRolled', onDiceRolled as EventListener);
  }, []);

  useEffect(() => {
    function onNeedDiceRoll(e: Event) {
      say('Need dice roll!');
      setNeedRoll(false);
    }

    window.addEventListener('needDiceRoll', onNeedDiceRoll as EventListener);
    return () => window.removeEventListener('needDiceRoll', onNeedDiceRoll as EventListener);
  }, []);

  return (
    <div className="dice-container ">
      <div
        id="dice"
        data-side={String(side)}
        className="dice"
        style={{ transformStyle: 'preserve-3d' }}
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
      {needRoll && <div>Roll dice!</div>}
    </div>
  );
};
