import React from 'react';
import { useTransitionPhase, FOG_IN_MS, FOG_HOLD_MS, FOG_OUT_MS } from '../../utils/transitionStore';
import '../../styles/FogTransition.css';

const FogTransition: React.FC = () => {
  const phase = useTransitionPhase();
  if (phase === 'idle') return null;

  // The durations live in transitionStore (it schedules the phases off the
  // same numbers) and are handed to the stylesheet here, so the fade and the
  // reveal it hides can't drift apart -- the CSS used to hardcode its own
  // copy, which made editing the constants do nothing at all on screen.
  const vars = {
    '--fog-in': `${FOG_IN_MS}ms`,
    '--fog-hold': `${FOG_HOLD_MS}ms`,
    '--fog-out': `${FOG_OUT_MS}ms`,
  } as React.CSSProperties;

  return (
    <div className={`fog-transition fog-${phase}`} style={vars} aria-hidden="true">
      <div className="fog-transition-symbol" />
    </div>
  );
};

export default FogTransition;
