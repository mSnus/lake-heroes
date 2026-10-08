import React, { useRef, useState, useEffect, useId } from 'react';
import { GridBattleState, TurnEvent, BattleSide, GridUnit, UnitKind } from '../game/battleGrid/types';
import { BrawlPlan, adjacentCells, energyFor } from '../game/battleGrid/engine';
import { useT } from '../i18n';
import '../styles/BattlefieldGrid.css';

type AnimPhase = 'idle' | 'attack-defend' | 'impact' | 'outcome';

/** A whole-side emoji override, or one per unit kind. */
export type SideIcon = string | Partial<Record<UnitKind, string>>;

interface BattlefieldGridProps {
  battle: GridBattleState;
  lastEvents: TurnEvent[];
  /** Which stage of this turn's 3-beat micro-animation is showing: 🗡️ who's
   * attacking -> 💥 who's under attack -> each unit's own result (☠️ died,
   * 🩸 wounded, 🛡️ blocked). Drives a temporary emoji override per unit —
   * see the per-unit lookup below. */
  animPhase?: AnimPhase;
  /** Mode-specific icon override for a whole side (🐉 dragon, 🧟‍♀️ zombies,
   * etc) in place of the normal rider/militia emoji — mirrors the old duel
   * screen's per-mode grid icons (BattleScreen decides which mode maps to
   * which side; this component just renders it). Pass a per-kind map
   * instead of a string to skin each tier separately — ambushers and rogue
   * hordes are 👹 on foot and 🦬 mounted, caravan guards 🥷 and 🐫 (see
   * utils/formatArmy's HORDE_EMOJI/CARAVAN_EMOJI, which the announcement
   * screens share). */
  attackerIcon?: SideIcon;
  defenderIcon?: SideIcon;
  /** Brawl mode: a compact board (BRAWL_COLS×BRAWL_ROWS) rendered with cells
   * and units at 180% of the normal height. */
  brawl?: boolean;
  /** A small automatic (non-brawl) battle: bigger cells/units than the
   * default battlefield, though not as large as brawl's. */
  large?: boolean;
  /** When set, this side is being manually controlled: a shadow layer of
   * draggable "twin" units appears over that side's units and the caller is
   * handed the chosen destinations via onManualComplete once every unit is
   * placed. */
  manualSide?: BattleSide;
  /** Called when the human finishes placing: `plan` is the destination per
   * unit, and `attacks` maps a unit to the specific enemy it was pointed at.
   * Any unit not in `attacks` — including one that simply moved and ended up
   * adjacent to an enemy, or one left untouched — auto-attacks like an AI
   * unit would; there's no way to opt out of attacking. */
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
  'defender-zombie': '🧟‍♀️',
};

/** Placement chosen this manual turn: the destination cell, plus (for a drop
 * onto an adjacent enemy) the enemy that unit means to attack. */
interface Placement {
  col: number;
  row: number;
  attackTargetId: string | null;
}

const colShiftFor = (row: number) => (row % 2 === 0 ? 0.7 : 0.2);

// Pointy-top hex geometry, kept in sync with BattlefieldGrid.css's
// --bfg-cell-h / --bfg-row: the hex box is taller than the horizontal pitch,
// and rows step down by 3/4 of that height so hexes tessellate.
const HEX_H_FACTOR = 1.1547; // hex box height / --bfg-cell (2/√3)
const HEX_ROW_FACTOR = 0.866; // row vertical pitch / --bfg-cell (√3/2)

// Below this much pointer travel, a release counts as a click (select for
// swap) rather than a drag (resolve as a drop) -- see the twin's onPointerUp.
const CLICK_MOVE_THRESHOLD_PX = 8;

export const BattlefieldGrid: React.FC<BattlefieldGridProps> = ({
  battle,
  lastEvents,
  animPhase = 'idle',
  attackerIcon,
  defenderIcon,
  brawl = false,
  large = false,
  manualSide,
  onManualComplete,
  instant = false,
}) => {
  const t = useT();
  const { cols, rows, units } = battle;
  const arenaRef = useRef<HTMLDivElement>(null);
  // Unique per mount so multiple battlefields on screen at once (unlikely
  // today, but cheap to guard) don't collide on the SVG filter's id.
  const hexFilterId = 'bfg-hex-border-' + useId().replace(/[^a-zA-Z0-9]/g, '');

  // ── Manual (drag) state ──
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  // Synchronously-updated mirror of `placements` — occupancy checks read this
  // so a unit dropped right after another one still sees that other unit's
  // just-committed cell (the render-closure `placements` can lag a drop).
  const placementsRef = useRef<Record<string, Placement>>({});
  const commitPlacements = (next: Record<string, Placement>) => {
    placementsRef.current = next;
    setPlacements(next);
  };

  const [drag, setDrag] = useState<{ unitId: string; x: number; y: number } | null>(null);
  // Where a drag started, to tell a real drag from a plain click on release
  // (see the swap gesture below) -- pointermove already updates `drag`
  // itself to the live position, so the start point needs its own ref.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  // Click-to-swap: click one of your own units, then click an adjacent
  // friendly one to trade their places -- replaces the old "click = hold in
  // place" gesture (holding in place is still reachable by dragging a unit
  // out and releasing it back on itself). Cleared on a new manual turn, on
  // clicking the same unit again, or once either half of a pair is placed
  // some other way.
  const [selectedForSwap, setSelectedForSwap] = useState<string | null>(null);

  // Brawl: clicking a unit (typically an enemy — a friendly unit's real cell
  // sits under its drag twin during your own placement turn, so only enemies
  // are actually reachable then) shows its remaining HP as a number under it
  // for 1s, or until a different unit is clicked, whichever comes first.
  const [hpRevealId, setHpRevealId] = useState<string | null>(null);
  const hpRevealTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const revealHp = (unitId: string) => {
    clearTimeout(hpRevealTimerRef.current);
    setHpRevealId(unitId);
    hpRevealTimerRef.current = setTimeout(() => setHpRevealId(null), 1000);
  };

  useEffect(() => () => clearTimeout(hpRevealTimerRef.current), []);
  // One batch per user action, so Undo can step back through one action at a
  // time — a plain placement is a 1-entry batch, a swap is 2 (both halves
  // revert together, or a swap could undo into an inconsistent state with
  // both units pointing at the same cell).
  const [undoStack, setUndoStack] = useState<{ unitId: string; prev: Placement | undefined }[][]>([]);
  const completedRef = useRef(false);

  // A fresh manual turn (new side, or a new round) clears any prior placements.
  useEffect(() => {
    commitPlacements({});
    setDrag(null);
    setUndoStack([]);
    setSelectedForSwap(null);
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
      const pl = placementsRef.current[u.id];
      if (pl) return { col: pl.col, row: pl.row };
    }

    return { col: u.col, row: u.row };
  };

  // Would this final cell already be occupied by some other living unit?
  const cellTaken = (col: number, row: number, exceptId: string): boolean =>
    units.some((u) => {
      if (u.hp <= 0 || u.id === exceptId) return false;
      const fc = finalCellOf(u);
      return fc.col === col && fc.row === row;
    });

  /** Either a normal one-unit placement, or a swap with another unplaced
   * friendly unit whose cell was dropped onto. */
  type DropResult = { kind: 'placement'; pl: Placement } | { kind: 'swap'; otherId: string };

  // On drop (real drags only — a near-zero-movement release never reaches
  // here, see the click-to-swap branch below), snap to whichever hex
  // neighbour is nearest the pointer and classify it: an adjacent enemy =
  // attack; an adjacent cell held by an unplaced friendly unit = swap with
  // that unit; an adjacent empty cell = move; anything else (occupied some
  // other way) = invalid. The unit's own cell isn't a candidate — dropping
  // on yourself is a no-op now (see the click threshold), and leaving it in
  // the running would win any drop released near the middle, since it's
  // always closer to home than to a neighbour.
  const resolveDrop = (clientX: number, clientY: number, unit: GridUnit): DropResult | null => {
    const cr = cellAndRect();
    if (!cr) return null;
    const { rect, cell, rowStep, cellH } = cr;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const origin = { col: unit.col, row: unit.row };

    const cells = adjacentCells(origin.col, origin.row, cols, rows);
    let target = origin;
    let bestD = Infinity;
    for (const c of cells) {
      const cx = (c.col + colShiftFor(c.row) + 0.5) * cell;
      const cy = c.row * rowStep + cellH / 2;
      const d = (cx - px) ** 2 + (cy - py) ** 2;
      if (d < bestD) {
        bestD = d;
        target = c;
      }
    }

    const enemyAt = enemies.find((e) => e.col === target.col && e.row === target.row);
    if (enemyAt) return { kind: 'placement', pl: { col: origin.col, row: origin.row, attackTargetId: enemyAt.id } }; // attack
    const friendAt = sideUnits.find(
      (f) => f.id !== unit.id && !placementsRef.current[f.id] && f.col === target.col && f.row === target.row
    );
    if (friendAt) return { kind: 'swap', otherId: friendAt.id }; // dropped onto a friendly unit — swap
    if (cellTaken(target.col, target.row, unit.id)) return null; // occupied some other way — don't place
    return { kind: 'placement', pl: { col: target.col, row: target.row, attackTargetId: null } }; // move
  };

  const place = (unit: GridUnit, pl: Placement) => {
    // Hard guard: a *move* may never land on a cell another unit will occupy
    // (an attack/stay keeps the unit on its own cell, so it's always fine).
    const isMove = !pl.attackTargetId && !(pl.col === unit.col && pl.row === unit.row);
    if (isMove && cellTaken(pl.col, pl.row, unit.id)) return;
    // Capture the previous placement *before* committing — commitPlacements
    // mutates placementsRef synchronously, so reading it inside the (deferred)
    // setUndoStack updater would see the new value instead of the old one.
    const prev = placementsRef.current[unit.id];
    setUndoStack((s) => [...s, [{ unitId: unit.id, prev }]]);
    commitPlacements({ ...placementsRef.current, [unit.id]: pl });
    completedRef.current = false;
    // A unit placed some other way (dragged instead of swapped) can't still
    // be the pending half of a click-to-swap pair.
    setSelectedForSwap((s) => (s === unit.id ? null : s));
  };

  const isHexAdjacent = (a: { col: number; row: number }, b: { col: number; row: number }): boolean =>
    adjacentCells(a.col, a.row, cols, rows).some((c) => c.col === b.col && c.row === b.row);

  // Click-to-swap: commits both units' placements in one update (rather than
  // two calls to `place`) so neither is ever transiently "in the way" of the
  // other under the normal friendly-occupied guard -- a swap is valid by
  // construction, each vacating exactly the cell the other enters. Recorded
  // as a single 2-entry undo batch, so Undo reverts both halves together.
  const performSwap = (a: GridUnit, b: GridUnit) => {
    if (placementsRef.current[a.id] || placementsRef.current[b.id]) return;
    const plA: Placement = { col: b.col, row: b.row, attackTargetId: null };
    const plB: Placement = { col: a.col, row: a.row, attackTargetId: null };
    // Read the previous placements HERE, not inside the setUndoStack updater:
    // that updater runs on a later render, by which point commitPlacements
    // below has already mutated placementsRef synchronously, so it would
    // record the brand-new placements as the "previous" ones. Undo then
    // restored the swap it was meant to revert, leaving both units placed and
    // therefore locked out of any further interaction. Same reason place()
    // captures `prev` up front.
    const prevA = placementsRef.current[a.id];
    const prevB = placementsRef.current[b.id];
    setUndoStack((s) => [...s, [{ unitId: a.id, prev: prevA }, { unitId: b.id, prev: prevB }]]);
    commitPlacements({ ...placementsRef.current, [a.id]: plA, [b.id]: plB });
    completedRef.current = false;
  };

  // Undo only the most recent action — restore every unit in that batch to
  // whatever it was before (its earlier placement, or un-placed).
  const undo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const next = { ...placementsRef.current };
    for (const entry of last) {
      if (entry.prev) next[entry.unitId] = entry.prev;
      else delete next[entry.unitId];
    }

    commitPlacements(next);
    setUndoStack((s) => s.slice(0, -1));
    setSelectedForSwap(null);
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
      const pl = placementsRef.current[u.id];
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
    // Every engaged unit attacks if it has a target -- 'defend'-only never
    // actually happens, so no separate icon for it here (🛡️ means "blocked,
    // no damage" in the outcome phase instead).
    for (const e of lastEvents) {
      if (e.type === 'attack') overrideEmoji.set(e.unitId, '🗡️');
    }
  } else if (animPhase === 'impact') {
    // Who's under attack this round, regardless of outcome yet. A critical
    // hit flashes ❣️ instead of the normal 💥 -- it'll still end up showing
    // ☠️ in the outcome phase below since a crit always kills.
    for (const e of lastEvents) {
      if (e.type === 'attack' && e.targetId) {
        overrideEmoji.set(e.targetId, e.critical ? '❣️' : '💥');
      }
    }
  } else if (animPhase === 'outcome') {
    // Every unit's own result flashes together: wounded (🩸), blocked (🛡️),
    // or died (☠️) -- in that order so a wounded+blocked unit shows the
    // block, and a dead one shows that above either, regardless of event order.
    for (const e of lastEvents) {
      if (e.type === 'attack' && e.targetId) overrideEmoji.set(e.targetId, '🩸');
    }

    for (const e of lastEvents) {
      if (e.type === 'block') overrideEmoji.set(e.unitId, '🛡️');
    }

    for (const e of lastEvents) {
      if (e.type === 'death') overrideEmoji.set(e.unitId, '☠️');
    }
  }

  const emojiFor = (u: GridUnit) => {
    const icon = u.side === 'attacker' ? attackerIcon : defenderIcon;
    const override = typeof icon === 'string' ? icon : icon?.[u.kind];
    return override ?? UNIT_EMOJI[`${u.side}-${u.kind}`];
  };

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
    {/* Shared hex-border filter (see BattlefieldGrid.css's .bfg-cell comment):
        dilates the polygon's own silhouette, flood-fills the dilated copy,
        then subtracts the original silhouette back out, leaving a uniform-
        width ring that follows the hex's edges/vertices exactly -- unlike a
        plain CSS `border` on a `clip-path`ed box, which is a rectangular
        stroke that only lines up with a polygon's flat edges and gets
        clipped unevenly (missing/pinched) at the diagonal edges and points. */}
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <filter id={hexFilterId} x="-30%" y="-30%" width="160%" height="160%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="dilated" />
          <feFlood floodColor="#ffffff" floodOpacity="0.35" result="borderColor" />
          <feComposite in="borderColor" in2="dilated" operator="in" result="borderFilled" />
          <feComposite in="borderFilled" in2="SourceAlpha" operator="out" result="borderRing" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="borderRing" />
          </feMerge>
        </filter>
      </defs>
    </svg>
    <div className={'bfg-battlefield' + (brawl ? ' bfg-brawl' : large ? ' bfg-large' : '') + (instant ? ' bfg-instant' : '')}>
      <div className="bfg-arena" ref={arenaRef}>
        <div
          className="bfg-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, var(--bfg-cell))`, gridTemplateRows: `repeat(${rows}, var(--bfg-row))` }}
        >
          {Array.from({ length: cols * rows }, (_, i) => {
            const row = Math.floor(i / cols);
            return (
              <svg
                key={i}
                className={'bfg-cell' + (row % 2 === 0 ? ' bfg-cell-shifted' : '')}
                viewBox="0 0 100 115.47"
                preserveAspectRatio="none"
              >
                <polygon
                  className="bfg-cell-hex"
                  points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87"
                  filter={`url(#${hexFilterId})`}
                />
              </svg>
            );
          })}
        </div>
        <div className="bfg-obstacles">
          {battle.obstacles.map((o) => (
            <div key={`obs-${o.col}-${o.row}`} className="bfg-obstacle" style={cellStyle(o.col, o.row)}>
              {o.emoji}
            </div>
          ))}
        </div>
        <div className="bfg-units">
          {units.map((u) => {
            const hpPct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
            const energyPct = Math.max(0, Math.round((u.energy / energyFor(u.kind)) * 100));
            const op = originalOpacity(u);
            return (
              <div
                key={u.id}
                className={'bfg-unit bfg-unit-' + u.side + (actedIds.has(u.id) ? ' bfg-unit-acted' : '')}
                style={{ ...cellStyle(u.col, u.row), ...(op !== undefined ? { opacity: op } : {}) }}
                title={`${u.kind} ${u.hp}/${u.maxHp} hp, ${u.energy}/${energyFor(u.kind)} energy`}
                onClick={brawl ? () => revealHp(u.id) : undefined}
              >
                <span className="bfg-unit-emoji">{overrideEmoji.get(u.id) ?? emojiFor(u)}</span>
                <span className="bfg-unit-hp">
                  <span className="bfg-unit-hp-fill" style={{ width: `${hpPct}%` }} />
                </span>
                <span className="bfg-unit-energy">
                  <span className="bfg-unit-energy-fill" style={{ width: `${energyPct}%` }} />
                </span>
                {hpRevealId === u.id && (
                  <span className="bfg-unit-hp-label">{Math.max(0, u.hp)}/{u.maxHp}</span>
                )}
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
              const isSelected = !pl && selectedForSwap === u.id;

              // Where the twin sits and how it looks: dragging follows the
              // pointer; selected (awaiting a swap partner) glows blue in
              // place; placed-by-move sits at its destination (0.7, no glow);
              // placed-by-attack is invisible (the ⚔️ mark stands in);
              // un-placed sits on the original with a yellow glow.
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
                if (isSelected) cls += ' bfg-twin-selected';
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
                    dragStartRef.current = { x: e.clientX, y: e.clientY };
                    setDrag({ unitId: u.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerMove={(e) => {
                    if (drag?.unitId === u.id) setDrag({ unitId: u.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerUp={(e) => {
                    if (drag?.unitId !== u.id) return;
                    const start = dragStartRef.current;
                    dragStartRef.current = null;
                    setDrag(null);

                    // A near-zero-movement release is a click, not a drag:
                    // click-to-swap instead of resolving it as a drop.
                    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : Infinity;
                    if (moved < CLICK_MOVE_THRESHOLD_PX) {
                      if (selectedForSwap === u.id) {
                        setSelectedForSwap(null); // clicked the same unit again — deselect
                        return;
                      }

                      if (selectedForSwap) {
                        const other = sideUnits.find((s) => s.id === selectedForSwap);
                        if (other && !placementsRef.current[other.id] && isHexAdjacent(u, other)) {
                          performSwap(u, other);
                          setSelectedForSwap(null);
                          return;
                        }
                      }

                      setSelectedForSwap(u.id); // select this one, awaiting an adjacent partner click
                      return;
                    }

                    const result = resolveDrop(e.clientX, e.clientY, u);
                    if (!result) return;
                    if (result.kind === 'swap') {
                      const other = sideUnits.find((s) => s.id === result.otherId);
                      if (other) performSwap(u, other);
                    } else {
                      place(u, result.pl);
                    }
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
