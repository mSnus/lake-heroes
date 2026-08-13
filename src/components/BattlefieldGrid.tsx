import React from 'react';
import { GridBattleState, TurnEvent } from '../game/battleGrid/types';
import '../styles/BattlefieldGrid.css';

type AnimPhase = 'idle' | 'attack-defend' | 'hit' | 'death';

interface BattlefieldGridProps {
  battle: GridBattleState;
  lastEvents: TurnEvent[];
  /** Which stage of this turn's 3-beat micro-animation is currently
   * showing (attack/defend icons -> hit flash -> death flash), driving a
   * temporary emoji override per unit — see the per-unit lookup below. */
  animPhase?: AnimPhase;
  /** Mode-specific icon override for a whole side (🐉 dragon, 👹 ambushers/
   * rogue horde, etc) in place of the normal rider/militia emoji — mirrors
   * the old duel screen's per-mode grid icons (BattleScreen decides which
   * mode maps to which side; this component just renders it). */
  attackerIcon?: string;
  defenderIcon?: string;
  /** Toggle for the octagon grid outline — a temporary debug aid, kept behind
   * a single prop so it's a one-line change to drop later. */
  showGridLines?: boolean;
  /** Brawl mode: a compact board (BRAWL_COLS×BRAWL_ROWS) rendered with cells
   * and units at 180% of the normal height. */
  brawl?: boolean;
}

const UNIT_EMOJI: Record<string, string> = {
  'attacker-rider': '🐎',
  'attacker-militia': '🧍',
  'defender-rider': '🐎',
  'defender-militia': '🧍',
  'defender-dragon': '🐉',
};

export const BattlefieldGrid: React.FC<BattlefieldGridProps> = ({
  battle,
  lastEvents,
  animPhase = 'idle',
  attackerIcon,
  defenderIcon,
  showGridLines = true,
  brawl = false,
}) => {
  const { cols, rows, units } = battle;
  // Combat participants only (not plain movement) — most units are moving
  // most turns, so including 'move' here meant nearly the whole army stayed
  // permanently gold-tinted for the rest of the fight instead of this
  // actually flagging anything meaningful.
  const actedIds = new Set(
    lastEvents.filter((e) => e.type === 'attack' || e.type === 'defend').map((e) => e.unitId)
  );

  // Per-unit transient emoji override for the current animation beat —
  // attack/defend icons on whoever's acting, a hit flash on whoever's being
  // attacked, a death flash on whoever's dying this turn.
  const overrideEmoji = new Map<string, string>();
  if (animPhase === 'attack-defend') {
    for (const e of lastEvents) {
      if (e.type === 'attack') overrideEmoji.set(e.unitId, '🗡️');
      else if (e.type === 'defend') overrideEmoji.set(e.unitId, '🛡️');
    }
  } else if (animPhase === 'hit') {
    for (const e of lastEvents) {
      if (e.type === 'attack' && e.targetId) overrideEmoji.set(e.targetId, '💥');
    }
  } else if (animPhase === 'death') {
    for (const e of lastEvents) {
      if (e.type === 'death') overrideEmoji.set(e.unitId, '☠️');
    }
  }

  return (
    <div className={'bfg-battlefield' + (showGridLines ? ' bfg-grid-visible' : '') + (brawl ? ' bfg-brawl' : '')}>
      <div className="bfg-arena">
      <div className="bfg-grid" style={{ gridTemplateColumns: `repeat(${cols}, var(--bfg-cell))`, gridTemplateRows: `repeat(${rows}, var(--bfg-cell))` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const row = Math.floor(i / cols);
          return <div key={i} className={'bfg-cell' + (row % 2 === 0 ? ' bfg-cell-shifted' : '')} />;
        })}
      </div>
      <div className="bfg-units">
        {units.map((u) => {
          const key = `${u.side}-${u.kind}`;
          const baseEmoji = (u.side === 'attacker' ? attackerIcon : defenderIcon) ?? UNIT_EMOJI[key];
          const hpPct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
          const colShift = u.row % 2 === 0 ? 0.5 : 0;
          return (
            <div
              key={u.id}
              className={'bfg-unit bfg-unit-' + u.side + (actedIds.has(u.id) ? ' bfg-unit-acted' : '')}
              style={{ left: `calc((${u.col} + ${colShift}) * var(--bfg-cell))`, top: `calc(${u.row} * var(--bfg-cell))` }}
              title={`${u.kind} ${u.hp}/${u.maxHp} hp`}
            >
              <span className="bfg-unit-emoji">{overrideEmoji.get(u.id) ?? baseEmoji}</span>
              <span className="bfg-unit-hp">
                <span className="bfg-unit-hp-fill" style={{ width: `${hpPct}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};
