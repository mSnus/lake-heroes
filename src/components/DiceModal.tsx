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
}

const DiceModal: React.FC<DiceModalProps> = ({ }) => {
  return (
    <DiceWidget gameState={null} />
  );
};

export default DiceModal;
