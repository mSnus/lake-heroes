import React from 'react';
import { DiceWidget } from './DiceWidget';

interface DiceModalProps {
  onRoll: (roll: number) => void;
  rolling: boolean;
}

const DiceModal: React.FC<DiceModalProps> = ({ onRoll, rolling }) => {
  return <DiceWidget onRoll={onRoll} rolling={rolling} />;
};

export default DiceModal;
