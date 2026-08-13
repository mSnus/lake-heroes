import React, { useRef, useState, useEffect } from 'react';
import { GridBattleState, TurnEvent, BattleSide, GridUnit } from '../game/battleGrid/types';
import { BrawlPlan, adjacentCells } from '../game/battleGrid/engine';
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
  /** When set, this side is being manually controlled: a shadow layer of
   * draggable "twin" units appears over that side's units and the caller is
   * handed the chosen destinations via onManualComplete once every unit is
   * placed. */
  manualSide?: BattleSide;
  onManualComplete?: (plan: BrawlPlan) => void;
}

const UNIT_EMOJI: Record<string, string> = {
  'attacker-rider': '🐎',
  'attacker-militia': '🧍',
  'defender-rider': '🐎',
  'defender-militia': '🧍',
  'defender-dragon': '🐉',
};

/** Placement chosen this manual turn: the destination cell, plus (for a drop
 * onto an adjacent enemy) the enemy that unit means to attack. */
interface Placement {
  col: number;
  row: number;
  attackTargetId: string | null;
}

const colShiftFor = (row: number) => (row % 2 === 0 ? 0.5 : 0);

export const BattlefieldGrid: React.FC<BattlefieldGridProps> = ({
  battle,
  lastEvents,
  animPhase = 'idle',
  attackerIcon,
  defenderIcon,
  showGridLines = true,
  brawl = false,
  manualSide,
  onManualComplete,
}) => {
  const { cols, rows, units } = battle;
  const arenaRef = useRef<HTMLDivElement>(null);

  // ── Manual (drag) state ──
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [drag, setDrag] = useState<{ unitId: string; x: number; y: number } | null>(null);
  const completedRef = useRef(false);

  // A fresh manual turn (new side, or a new round) clears any prior placements.
  useEffect(() => {
    setPlacements({});
    setDrag(null);
    completedRef.current = false;
  }, [manualSide, battle.turn]);

  const sideUnits = manualSide ? units.filter((u) => u.side === manualSide && u.hp > 0) : [];
  const enemies = manualSide ? units.filter((u) => u.side !== manualSide && u.hp > 0) : [];

  // Once every one of this side's units has a placement, hand the plan back.
  useEffect(() => {
    if (!manualSide || completedRef.current) return;
    if (sideUnits.length === 0) return;
    if (!sideUnits.every((u) => placements[u.id])) return;
    completedRef.current = true;
    const plan: BrawlPlan = {};
    for (const u of sideUnits) {
      const pl = placements[u.id];
      plan[u.id] = { col: pl.col, row: pl.row };
    }
    onManualComplete?.(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, manualSide]);

  const cellAndRect = () => {
    const el = arenaRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { rect, cell: rect.width / cols };
  };

  const pointerToCell = (clientX: number, clientY: number) => {
    const cr = cellAndRect();
    if (!cr) return null;
    const { rect, cell } = cr;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let row = Math.round(y / cell - 0.5);
    row = Math.max(0, Math.min(rows - 1, row));
    let col = Math.round(x / cell - 0.5 - colShiftFor(row));
    col = Math.max(0, Math.min(cols - 1, col));
    return { col, row };
  };

  const commitPlacement = (unit: GridUnit, target: { col: number; row: number }) => {
    const origin = { col: unit.col, row: unit.row };
    const isOrigin = target.col === origin.col && target.row === origin.row;
    const isAdjacent = adjacentCells(origin.col, origin.row, cols, rows).some(
      (c) => c.col === target.col && c.row === target.row
    );
    if (!isAdjacent && !isOrigin) return; // dropped too far — leave unplaced

    const enemyAt = enemies.find((u) => u.col === target.col && u.row === target.row);
    if (enemyAt && isAdjacent) {
      // Attack an adjacent enemy: the unit stays put and marks its target.
      setPlacements((p) => ({ ...p, [unit.id]: { col: origin.col, row: origin.row, attackTargetId: enemyAt.id } }));
      return;
    }
    if (isOrigin) {
      setPlacements((p) => ({ ...p, [unit.id]: { col: origin.col, row: origin.row, attackTargetId: null } }));
      return;
    }
    // Move into an adjacent empty cell — not onto an enemy, not onto a cell
    // another twin already claimed this turn.
    const occupiedByEnemy = enemies.some((u) => u.col === target.col && u.row === target.row);
    const claimed = Object.entries(placements).some(
      ([id, pl]) => id !== unit.id && pl.col === target.col && pl.row === target.row
    );
    if (occupiedByEnemy || claimed) return;
    setPlacements((p) => ({ ...p, [unit.id]: { col: target.col, row: target.row, attackTargetId: null } }));
  };

  // ── Combat playback overrides (unchanged) ──
  const actedIds = new Set(
    lastEvents.filter((e) => e.type === 'attack' || e.type === 'defend').map((e) => e.unitId)
  );
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

  const emojiFor = (u: GridUnit) =>
    (u.side === 'attacker' ? attackerIcon : defenderIcon) ?? UNIT_EMOJI[`${u.side}-${u.kind}`];

  // Original-unit opacity while its own side is being manually controlled: a
  // unit that's moved is gone from its old cell (0); one that's staying to
  // attack lingers dimmed (0.7); an un-placed one shows normally under its twin.
  const originalOpacity = (u: GridUnit): number | undefined => {
    if (!manualSide || u.side !== manualSide) return undefined;
    const pl = placements[u.id];
    if (!pl) return 1;
    return pl.attackTargetId ? 0.7 : 0;
  };

  const cellStyle = (col: number, row: number): React.CSSProperties => ({
    left: `calc((${col} + ${colShiftFor(row)}) * var(--bfg-cell))`,
    top: `calc(${row} * var(--bfg-cell))`,
  });

  const enemiesById = new Map(enemies.map((e) => [e.id, e]));

  return (
    <div className={'bfg-battlefield' + (showGridLines ? ' bfg-grid-visible' : '') + (brawl ? ' bfg-brawl' : '')}>
      <div className="bfg-arena" ref={arenaRef}>
        <div
          className="bfg-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, var(--bfg-cell))`, gridTemplateRows: `repeat(${rows}, var(--bfg-cell))` }}
        >
          {Array.from({ length: cols * rows }, (_, i) => {
            const row = Math.floor(i / cols);
            return <div key={i} className={'bfg-cell' + (row % 2 === 0 ? ' bfg-cell-shifted' : '')} />;
          })}
        </div>
        <div className="bfg-units">
          {units.map((u) => {
            const hpPct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
            const op = originalOpacity(u);
            return (
              <div
                key={u.id}
                className={'bfg-unit bfg-unit-' + u.side + (actedIds.has(u.id) ? ' bfg-unit-acted' : '')}
                style={{ ...cellStyle(u.col, u.row), ...(op !== undefined ? { opacity: op } : {}) }}
                title={`${u.kind} ${u.hp}/${u.maxHp} hp`}
              >
                <span className="bfg-unit-emoji">{overrideEmoji.get(u.id) ?? emojiFor(u)}</span>
                <span className="bfg-unit-hp">
                  <span className="bfg-unit-hp-fill" style={{ width: `${hpPct}%` }} />
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Manual control: ⚔️ marks on attacked enemies + draggable twins ── */}
        {manualSide && (
          <div className="bfg-shadow">
            {sideUnits.map((u) => {
              const pl = placements[u.id];
              if (!pl?.attackTargetId) return null;
              const enemy = enemiesById.get(pl.attackTargetId);
              if (!enemy) return null;
              return (
                <div key={`atk-${u.id}`} className="bfg-attack-mark" style={cellStyle(enemy.col, enemy.row)}>
                  ⚔️
                </div>
              );
            })}
            {sideUnits.map((u) => {
              const pl = placements[u.id];
              const isDragging = drag?.unitId === u.id;

              // Where the twin sits and how it looks: dragging follows the
              // pointer; placed-by-move sits at its destination (0.7, no glow);
              // placed-by-attack is invisible (the ⚔️ mark stands in); un-placed
              // sits on the original with a yellow glow.
              let style: React.CSSProperties;
              let cls = 'bfg-twin bfg-unit-' + u.side;
              if (isDragging) {
                const cr = cellAndRect();
                const cellPx = cr?.cell ?? 0;
                const left = drag!.x - (cr?.rect.left ?? 0) - cellPx / 2;
                const top = drag!.y - (cr?.rect.top ?? 0) - cellPx / 2;
                style = { left: `${left}px`, top: `${top}px` };
                cls += ' bfg-twin-dragging';
              } else if (pl?.attackTargetId) {
                style = { ...cellStyle(pl.col, pl.row), opacity: 0 };
              } else if (pl) {
                style = { ...cellStyle(pl.col, pl.row), opacity: 0.7 };
                cls += ' bfg-twin-placed';
              } else {
                style = cellStyle(u.col, u.row);
                cls += ' bfg-twin-active';
              }

              return (
                <div
                  key={`twin-${u.id}`}
                  className={cls}
                  style={style}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    completedRef.current = false;
                    setDrag({ unitId: u.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerMove={(e) => {
                    if (drag?.unitId === u.id) setDrag({ unitId: u.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerUp={(e) => {
                    if (drag?.unitId !== u.id) return;
                    const target = pointerToCell(e.clientX, e.clientY);
                    if (target) commitPlacement(u, target);
                    setDrag(null);
                  }}
                >
                  <span className="bfg-unit-emoji">{emojiFor(u)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
