import React, { useEffect, useRef, useState } from 'react';
import { Dice } from '../game/Dice';

export const DiceWidget: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [side, setSide] = useState<number>(1);
  const [reRoll, setReRoll] = useState(false);
  const diceRef = useRef<HTMLDivElement | null>(null);
  const dice = useRef(new Dice());
  const animationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function onRoll(e: Event) {
      const detail = (e as CustomEvent).detail;
      const value = typeof detail === 'number' ? detail : (detail && (detail.result || 1)) || 1;
      setSide(value);
      setVisible(true);

      setReRoll(true);
      if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = window.setTimeout(() => {
        setReRoll(false);
        // notify that dice animation stopped and provide final value
        window.dispatchEvent(new CustomEvent('diceAnimationStopped', { detail: value }));
      }, 1600) as unknown as number;
    }
    window.addEventListener('diceRolled', onRoll as EventListener);
    return () => window.removeEventListener('diceRolled', onRoll as EventListener);
  }, []);

  useEffect(() => {
    function onStart(e: Event) {
      // Start a roll programmatically (this will dispatch `diceRolled` from Dice.roll())
      const result = dice.current.roll();
      // Immediate visual state for the widget (Dice.roll will also dispatch diceRolled; handler above will run too)
      setSide(result);
      setVisible(true);
      setReRoll(true);
      if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = window.setTimeout(() => {
        setReRoll(false);
        window.dispatchEvent(new CustomEvent('diceAnimationStopped', { detail: result }));
      }, 1600) as unknown as number;
    }
    window.addEventListener('startDiceRoll', onStart as EventListener);
    return () => window.removeEventListener('startDiceRoll', onStart as EventListener);
  }, []);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  function handleClick() {
    // roll via Dice instance; roll() dispatches the diceRolled event
    const r = dice.current.roll();
    // immediate feedback
    setSide(r);
    setVisible(true);
    setReRoll(true);
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = window.setTimeout(() => {
      setReRoll(false);
      window.dispatchEvent(new CustomEvent('diceAnimationStopped', { detail: r }));
    }, 1600) as unknown as number;
  }

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000 }}>
      <div
        id="dice"
        data-side={String(side)}
        className={reRoll ? 'reRoll' : ''}
        onClick={handleClick}
        ref={diceRef}
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
