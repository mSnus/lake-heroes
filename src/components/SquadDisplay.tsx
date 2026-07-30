import React from 'react';
import { buildSquadChunks } from '../game/army';
import '../styles/SquadDisplay.css';

interface SquadDisplayProps {
  militia: number;
  riders: number;
  totalSlots: number;
  /** When provided, a ✖️ button appears next to every non-empty squad,
   * calling back with that squad's tier/count to sell. Omit for read-only
   * display (e.g. the player-stats panel). */
  onSellSquad?: (tier: 'militia' | 'riders', count: number) => void;
  className?: string;
}

export const SquadDisplay: React.FC<SquadDisplayProps> = ({
  militia,
  riders,
  totalSlots,
  onSellSquad,
  className,
}) => {
  const chunks = buildSquadChunks(militia, riders, totalSlots);

  return (
    <div className={['squad-display', className].filter(Boolean).join(' ')}>
      {chunks.map((chunk, i) => (
        <span key={i} className="squad-chunk">
          {chunk.count}
          {chunk.tier === 'riders' ? '🐎' : '🧍'}
          {onSellSquad && chunk.count > 0 && (
            <button
              className="squad-sell-button"
              title="Sell this squad"
              onClick={() => onSellSquad(chunk.tier, chunk.count)}
            >
              ✖️
            </button>
          )}
        </span>
      ))}
    </div>
  );
};

export default SquadDisplay;
