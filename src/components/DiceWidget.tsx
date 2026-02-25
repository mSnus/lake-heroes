import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import '../styles/dice.css';
import { gameEvent } from '../utils/events';
import { rollDice } from '../game/Dice';
import { on } from 'events';
interface Props {
  gameState: GameState | null;
  onRoll: (roll: number) => void;
}

export const DiceWidget: React.FC<Props> = ({ gameState, onRoll }) => {
  const [side, setSide] = useState<number>(0);

  const animationTimeout = useRef<number | null>(null);

  // Ref so the stable listener below always calls the latest onRoll
  const onRollRef = useRef(onRoll);
  useEffect(() => { onRollRef.current = onRoll; }, [onRoll]);

  useEffect(() => {
    function onDiceRolled(e: Event) {
      const detail = (e as CustomEvent).detail;
      const value = typeof detail === 'number' ? detail : 1;

      if (gameState) gameState.lastDice = value;

      console.log('Dice rolled:', value);

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
    function onDiceFinished(e: Event) {
      const detail = (e as CustomEvent).detail as number;
      console.log('Dice finished, onRoll called for roll:', detail);
      onRollRef.current(detail);
    }

    window.addEventListener('diceAnimationStopped', onDiceFinished as EventListener);
    return () =>
      window.removeEventListener('diceAnimationStopped', onDiceFinished as EventListener);
  }, []);

  const handleClick = () => {
    gameEvent('displayTitle', {});
    rollDice();
  };

  return (
    <div className="dice-container ">
      <div
        id="dice"
        data-side={String(side)}
        className="dice"
        style={{ transformStyle: 'preserve-3d' }}
        onClick={handleClick}
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

      <div className="dice-roll">Roll dice!</div>
    </div>
  );
};
