import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LogMessage } from '../../utils/logMessage';
import { colouredNames } from '../snippets/GameMessage';
import { stripHtml } from '../../utils/html';
import { useLogDrawerPulses } from '../../utils/logDrawerStore';
import '../../styles/LogDrawer.css';

/** The grip strip at the drawer's bottom edge, always left peeking over the map. */
const HANDLE_PX = 18;
const HOLD_MS_PER_LINE = 700;
/** Pulling the drawer this far down (share of the map's height) keeps it open. */
const PIN_SHARE = 2 / 3;
/** A peek never covers more than this share of the map, however many lines arrived. */
const MAX_PEEK_SHARE = 0.45;
/** Messages posted while the game is loading don't pull the drawer down. */
const LOAD_QUIET_MS = 2000;

type Mode = 'hidden' | 'peek' | 'open';

interface LogDrawerProps {
  entries: LogMessage[];
  players: { name: string; color?: string }[];
}

/**
 * The game log as a drawer over the map, latest line last. It replaces
 * toasts: each new message slides it down just far enough to show the new
 * lines, holds them ~0.7s apiece, then lets it slide back up. The grip at its
 * bottom pulls it further down (it springs back on release) or, past 2/3 of
 * the map, leaves it open and scrollable until it is dragged back up.
 */
export const LogDrawer: React.FC<LogDrawerProps> = ({ entries, players }) => {
  const pulses = useLogDrawerPulses();
  const shown = entries.filter((e) => e.level !== 'debug');

  const clipRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('hidden');
  const [offset, setOffset] = useState(HANDLE_PX);
  const [dragging, setDragging] = useState(false);
  const pendingLines = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ startY: number; startOffset: number } | null>(null);
  const lastPulses = useRef(pulses);

  // The map's height, kept current as the board resizes. A resize moves the drawer
  // without its slide animation, so it never shows while the page settles.
  const [mapHeight, setMapHeight] = useState(0);
  const [resizing, setResizing] = useState(true);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedAt = useRef(Date.now());
  useLayoutEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const measure = () => {
      setResizing(true);
      setMapHeight(el.clientHeight);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => setResizing(false), 100);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = () => clipRef.current?.clientHeight ?? mapHeight;

  const hide = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pendingLines.current = 0;
    setMode('hidden');
    setOffset(HANDLE_PX);
  };

  // How much of the drawer must show for its last `lines` entries to be visible.
  const peekOffset = (lines: number): number => {
    const list = listRef.current;
    if (!list) return HANDLE_PX;
    const rows = Array.from(list.children).slice(-lines) as HTMLElement[];
    const rowsHeight = rows.reduce((sum, r) => sum + r.offsetHeight, 0);
    return Math.min(height() * MAX_PEEK_SHARE, rowsHeight + 8 + HANDLE_PX);
  };

  // A new message: show the lines that arrived since the drawer last went up.
  // A message merged into the last line (same player and topic) adds no line.
  const lastLength = useRef(shown.length);
  useLayoutEffect(() => {
    const added = pulses - lastPulses.current;
    lastPulses.current = pulses;
    const newRows = shown.length - lastLength.current;
    lastLength.current = shown.length;
    if (mode === 'open' || drag.current || Date.now() - loadedAt.current < LOAD_QUIET_MS) return;

    if (added > 0) {
      pendingLines.current = newRows > 0 ? pendingLines.current + newRows : Math.max(pendingLines.current, 1);
    } else if (newRows > 0 && mode === 'peek') {
      pendingLines.current += newRows;
    } else {
      return;
    }

    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    setMode('peek');
    setOffset(peekOffset(pendingLines.current));
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(hide, HOLD_MS_PER_LINE * pendingLines.current);
  }, [pulses, shown.length]);

  // Closed or peeking, the list stays scrolled to its latest line.
  useEffect(() => {
    if (mode !== 'open' && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [shown.length, mode]);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (resizeTimer.current) clearTimeout(resizeTimer.current);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    drag.current = { startY: e.clientY, startOffset: offset };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset(Math.max(HANDLE_PX, Math.min(height(), d.startOffset + e.clientY - d.startY)));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    setDragging(false);
    if (offset > height() * PIN_SHARE) {
      pendingLines.current = 0;
      setMode('open');
      setOffset(height());
      return;
    }

    hide();
  };

  return (
    <div className="log-drawer-clip" ref={clipRef}>
      <div
        className={
          'log-drawer' +
          (dragging ? ' log-drawer--dragging' : '') +
          (resizing ? ' log-drawer--still' : '') +
          (mode === 'hidden' ? ' log-drawer--hiding' : '')
        }
        style={{
          transform: `translateY(${(mode === 'open' && !dragging ? mapHeight : offset) - mapHeight}px)`,
          visibility: mapHeight ? 'visible' : 'hidden',
        }}
      >
        <div ref={listRef} className={'log-drawer-list' + (mode === 'open' ? ' log-drawer-list--open' : '')}>
          {shown.map((e, i) => (
            <div key={`${e.timestamp}-${i}`} className={`log-drawer-line log-drawer-line--${e.level}`}>
              {colouredNames(stripHtml(e.message), players)}
            </div>
          ))}
        </div>
        <div
          className="log-drawer-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="log-drawer-grip-pill">
            <span className="log-drawer-grip" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default LogDrawer;
