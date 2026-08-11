import React from 'react';
import { GridBattleState, TurnEvent } from '../game/battleGrid/types';
import '../styles/BattlefieldGrid.css';

interface BattlefieldGridProps {
  battle: GridBattleState;
  lastEvents: TurnEvent[];
  /** Toggle for the octagon grid outline — a temporary debug aid, kept behind
   * a single prop so it's a one-line change to drop later. */
  showGridLines?: boolean;
}

const UNIT_EMOJI: Record<string, string> = {
  'attacker-rider': '🐎',
  'attacker-militia': '🧍',
  'defender-rider': '🐎',
  'defender-militia': '🧍',
};

export const BattlefieldGrid: React.FC<BattlefieldGridProps> = ({ battle, lastEvents, showGridLines = true }) => {
  const { cols, rows, units } = battle;
  const actedIds = new Set(lastEvents.filter((e) => e.type !== 'skip').map((e) => e.unitId));

  const joints: React.ReactNode[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      joints.push(
        <div
          key={`j-${c}-${r}`}
          className="bfg-joint"
          style={{ left: `calc((${c} + 1) * var(--bfg-cell))`, top: `calc((${r} + 1) * var(--bfg-cell))` }}
        />
      );
    }
  }

  return (
    <div className={'bfg-battlefield' + (showGridLines ? ' bfg-grid-visible' : '')}>
      <div className="bfg-grid" style={{ gridTemplateColumns: `repeat(${cols}, var(--bfg-cell))`, gridTemplateRows: `repeat(${rows}, var(--bfg-cell))` }}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <div key={i} className="bfg-cell" />
        ))}
      </div>
      <div className="bfg-joints">{joints}</div>
      <div className="bfg-units">
        {units.map((u) => {
          const key = `${u.side}-${u.kind}`;
          const hpPct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
          return (
            <div
              key={u.id}
              className={'bfg-unit bfg-unit-' + u.side + (actedIds.has(u.id) ? ' bfg-unit-acted' : '')}
              style={{ left: `calc(${u.col} * var(--bfg-cell))`, top: `calc(${u.row} * var(--bfg-cell))` }}
              title={`${u.kind} ${u.hp}/${u.maxHp} hp`}
            >
              <span className="bfg-unit-emoji">{UNIT_EMOJI[key]}</span>
              <span className="bfg-unit-hp">
                <span className="bfg-unit-hp-fill" style={{ width: `${hpPct}%` }} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
