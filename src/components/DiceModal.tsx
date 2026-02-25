import React from 'react';
import '../styles/modal.css';
import { DiceWidget } from './DiceWidget';

export interface PlayerSetup {
  name: string;
  color: string;
  image: string;
  gold: number;
  units: number;
  position: number;
}

interface DiceModalProps {
  onRoll: (roll: number) => void;
}

const DiceModal: React.FC<DiceModalProps> = ({ onRoll }) => {
  return (
    <DiceWidget gameState={null} onRoll={onRoll} />
  );
};

export default DiceModal;
