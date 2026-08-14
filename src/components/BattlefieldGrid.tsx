import React, { useRef, useState, useEffect } from 'react';
import { GridBattleState, TurnEvent, BattleSide, GridUnit } from '../game/battleGrid/types';
import { BrawlPlan, adjacentCells } from '../game/battleGrid/engine';
import { useT } from '../i18n';
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
  /** Called when the human finishes placing: `plan` is the destination per
   * unit, `attacks` maps a unit to the specific enemy it was pointed at (units
   * not listed don't attack — they hold/defend). */
  onManualComplete?: (plan: BrawlPlan, attacks: Record<string, string>) => void;
  /** Suppress the unit slide transition for one commit — used to snap the real
   * units straight to where the twins already showed them, instead of
   * re-animating the moves the player just made. */
  instant?: boolean;
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

// Pointy-top hex geometry, kept in sync with BattlefieldGrid.css's
// --bfg-cell-h / --bfg-row: the hex box is taller than the horizontal pitch,
// and rows step down by 3/4 of that height so hexes tessellate.
const HEX_H_FACTOR = 1.1547; // hex box height / --bfg-cell (2/√3)
const HEX_ROW_FACTOR = 0.866; // row vertical pitch / --bfg-cell (√3/2)

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
  instant = false,
}) => {
  const t = useT();
  const { cols, rows, units } = battle;
  const arenaRef = useRef<HTMLDivElement>(null);

  // ── Manual (drag) state ──
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [drag, setDrag] = useState<{ unitId: string; x: number; y: number } | null>(null);
  // One entry per placement, so Undo can step back to the previous state of
  // just the last-moved unit.
  const [undoStack, setUndoStack] = useState<{ unitId: string; prev: Placement | undefined }[]>([]);
  const completedRef = useRef(false);

  // A fresh manual turn (new side, or a new round) clears any prior placements.
  useEffect(() => {
    setPlacements({});
    setDrag(null);
    setUndoStack([]);
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
    const attacks: Record<string, string> = {};
    for (const u of sideUnits) {
      const pl = placements[u.id];
      plan[u.id] = { col: pl.col, row: pl.row };
      if (pl.attackTargetId) attacks[u.id] = pl.attackTargetId;
    }
    onManualComplete?.(plan, attacks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, manualSide]);

  const cellAndRect = () => {
    const el = arenaRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cell = rect.width / cols; // horizontal pitch (= --bfg-cell)
    return { rect, cell, rowStep: cell * HEX_ROW_FACTOR, cellH: cell * HEX_H_FACTOR };
  };

  // The unit's final cell this turn — its placement if set, else where it
  // stands. Enemies don't move during this side's turn.
  const finalCellOf = (u: GridUnit): { col: number; row: number } => {
    if (manualSide && u.side === manualSide) {
      const pl = placements[u.id];
      if (pl) return { col: pl.col, row: pl.row };
    }
    return { col: u.col, row: u.row };
  };

  // On drop, snap to the nearest *valid* target — the unit's own cell (stay),
  // an adjacent empty cell (move), or an adjacent enemy (attack) — by true
  // cell-centre distance, so a diagonal drag lands on the diagonal hex rather
  // than the nearest straight-up/down cell.
  const resolveDrop = (clientX: number, clientY: number, unit: GridUnit): Placement | null => {
    const cr = cellAndRect();
    if (!cr) return null;
    const { rect, cell, rowStep, cellH } = cr;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const origin = { col: unit.col, row: unit.row };

    const candidates: Placement[] = [{ col: origin.col, row: origin.row, attackTargetId: null }]; // stay
    for (const n of adjacentCells(origin.col, origin.row, cols, rows)) {
      const enemyAt = enemies.find((u) => u.col === n.col && u.row === n.row);
      if (enemyAt) {
        // attacking keeps the unit on its own cell, but it's reached via the enemy's cell
        candidates.push({ col: origin.col, row: origin.row, attackTargetId: enemyAt.id });
        continue;
      }
      const blocked = units.some(
        (u) => u.hp > 0 && u.id !== unit.id && finalCellOf(u).col === n.col && finalCellOf(u).row === n.row
      );
      if (!blocked) candidates.push({ col: n.col, row: n.row, attackTargetId: null });
    }

    // Measure to the cell the drag is actually reaching for (the enemy's cell
    // for an attack, otherwise the destination itself).
    const reachCell = (c: Placement) => {
      if (c.attackTargetId) {
        const e = enemies.find((en) => en.id === c.attackTargetId);
        if (e) return { col: e.col, row: e.row };
      }
      return { col: c.col, row: c.row };
    };
    let best: Placement | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const tc = reachCell(c);
      const cx = (tc.col + colShiftFor(tc.row) + 0.5) * cell;
      const cy = tc.row * rowStep + cellH / 2;
      const d = (cx - px) ** 2 + (cy - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  };

  const place = (unit: GridUnit, pl: Placement) => {
    setUndoStack((s) => [...s, { unitId: unit.id, prev: placements[unit.id] }]);
    setPlacements((prev) => ({ ...prev, [unit.id]: pl }));
    completedRef.current = false;
  };

  // Undo only the most recent placement — restore that one unit to whatever it
  // was before (its earlier placement, or un-placed).
  const undo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setPlacements((prev) => {
      const next = { ...prev };
      if (last.prev) next[last.unitId] = last.prev;
      else delete next[last.unitId];
      return next;
    });
    setUndoStack((s) => s.slice(0, -1));
    completedRef.current = false;
  };

  // Finish the turn now: placed units keep their placement, un-placed ones stay
  // put.
  const finishTurn = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const plan: BrawlPlan = {};
    const attacks: Record<string, string> = {};
    for (const u of sideUnits) {
      const pl = placements[u.id];
      plan[u.id] = pl ? { col: pl.col, row: pl.row } : { col: u.col, row: u.row };
      if (pl?.attackTargetId) attacks[u.id] = pl.attackTargetId;
    }
    onManualComplete?.(plan, attacks);
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
    top: `calc(${row} * var(--bfg-row))`,
  });

  const enemiesById = new Map(enemies.map((e) => [e.id, e]));

  return (
    <>
    <div className={'bfg-battlefield' + (showGridLines ? ' bfg-grid-visible' : '') + (brawl ? ' bfg-brawl' : '') + (instant ? ' bfg-instant' : '')}>
      <div className="bfg-arena" ref={arenaRef}>
        <div
          className="bfg-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, var(--bfg-cell))`, gridTemplateRows: `repeat(${rows}, var(--bfg-row))` }}
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
                const left = drag!.x - (cr?.rect.left ?? 0) - (cr?.cell ?? 0) / 2;
                const top = drag!.y - (cr?.rect.top ?? 0) - (cr?.cellH ?? 0) / 2;
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
                    // Once a unit has been placed this turn it's locked in — no
                    // re-dragging until the next turn (use Undo to free it).
                    if (pl) return;
                    e.preventDefault();
                    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    setDrag({ unitId: u.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerMove={(e) => {
                    if (drag?.unitId === u.id) setDrag({ unitId: u.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerUp={(e) => {
                    if (drag?.unitId !== u.id) return;
                    const pl = resolveDrop(e.clientX, e.clientY, u);
                    if (pl) place(u, pl);
                    setDrag(null);
                  }}
                >
                  <span className="bfg-unit-emoji">{emojiFor(u)}</span>
                  {/* Invisible HP bar so the twin's emoji sits exactly where the
                      real unit's does (same column layout) — no vertical jump
                      when the real units snap in and the twins hide. */}
                  <span className="bfg-unit-hp" style={{ opacity: 0 }}>
                    <span className="bfg-unit-hp-fill" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Kept in the DOM through the whole brawl (not just the manual turn) so
        the battlefield doesn't shift when they appear/disappear — hidden and
        disabled while it isn't the human's turn to place. */}
    {brawl && (
      <div className={'bfg-manual-controls' + (manualSide ? '' : ' bfg-manual-controls--hidden')} aria-hidden={!manualSide}>
        <div
          className={'shield-button-container' + (!manualSide || undoStack.length === 0 ? ' shield-button-container--disabled' : '')}
          title={t('battleScreen.brawlUndo')}
        >
          <button className="shield-button" onClick={undo} disabled={!manualSide || undoStack.length === 0}>
            ⬅️
          </button>
        </div>
        <div className="shield-button-container" title={t('battleScreen.brawlGo')}>
          <button className="shield-button" onClick={finishTurn} disabled={!manualSide}>
            🚩
          </button>
        </div>
      </div>
    )}
    </>
  );
};
