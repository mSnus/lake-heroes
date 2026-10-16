import React, { useEffect, useRef } from 'react';
import ReactDice, { ReactDiceRef } from 'react-dice-complete';
import '../../styles/dice.css';
import { closeModal, consumeForcedRoll } from '../../utils/diceStore';
import { rollDice } from '../../game/Dice';

// Must match the rollTime prop passed to ReactDice (in ms)
const ROLL_TIME_MS = 1500;

const DICE_PROPS = {
  rollDone: () => {},
  faceColor: '#efe5dc',
  dotColor: '#5a3a1a',
  dieSize: 80,
  disableIndividual: true,
  rollTime: 1.5,
  outline: true,
  outlineColor: '#8b6914',
} as const;

interface Props {
  onRoll: (roll: number) => void;
  rolling: boolean;
}

export const DiceWidget: React.FC<Props> = ({ onRoll, rolling }) => {
  const diceRef = useRef<ReactDiceRef>(null);
  const rollValueRef = useRef<number>(1);

  useEffect(() => {
    if (!rolling) return;
    rollValueRef.current = consumeForcedRoll() ?? rollDice();
    diceRef.current?.rollAll([rollValueRef.current]);
    const timer = setTimeout(() => {
      closeModal();
      onRoll(rollValueRef.current);
    }, ROLL_TIME_MS + 200);
    return () => clearTimeout(timer);
  }, [rolling]);

  if (!rolling) return null;

  return (
    <div className="dice-container">
      <ReactDice numDice={1} ref={diceRef} {...DICE_PROPS} />
    </div>
  );
};
