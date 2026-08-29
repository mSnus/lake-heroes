import React from 'react';
import { useTransitionPhase } from '../utils/transitionStore';
import '../styles/FogTransition.css';

const FogTransition: React.FC = () => {
  const phase = useTransitionPhase();
  if (phase === 'idle') return null;

  return (
    <div className={`fog-transition fog-${phase}`} aria-hidden="true">
      <div className="fog-transition-symbol" />
    </div>
  );
};

export default FogTransition;
