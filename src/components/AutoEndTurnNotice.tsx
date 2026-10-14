import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { useModal } from '../utils/diceStore';
import { useScreen } from '../utils/screenStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { isLocalHuman } from '../game/seats';
import { canClaimTile } from '../game/tileOwnership';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useT } from '../i18n';
import '../styles/AutoEndTurnNotice.css';

const WARMUP_MS = 5000; // silent idle wait before the gauge appears at all
const DURATION_MS = 3000; // visible, cancelable countdown once it does
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface AutoEndTurnNoticeProps {
  gameState: GameState;
  updateGameState: (board: GameState) => void;
}

/**
 * Auto-ends the turn after a stretch of inactivity, once there's nothing
 * left to decide -- the same readiness the 🚩 End Turn button itself gates
 * on (see ShieldColumn's canEndTurn), with one more condition of its own: a
 * tile the player could still afford to claim right where they're standing
 * (see game/tileOwnership.ts's canClaimTile) also holds it off, since
 * that's a real decision pending even though nothing here renders it as a
 * screen. Only ever runs for a seat this browser plays in person (never a
 * bot's, which BotController already drives on its own).
 *
 * Two phases, WARMUP_MS + DURATION_MS apart (8s total by default): the
 * first WARMUP_MS of idling are silent -- nothing shows at all -- and only
 * once that elapses does the radial gauge itself appear, draining over the
 * following DURATION_MS and ending the turn the instant it empties. Shown
 * (once it does) at the same screen position/style family as
 * TurnAnnouncement. Any click anywhere -- the map, a tile, a player icon,
 * opening a screen, starting a dice roll -- resets BOTH phases back to the
 * start and hides the gauge if it was showing; tapping the notice itself
 * instead cancels auto-end-turn for the rest of this turn specifically,
 * re-arming automatically once it's someone else's turn (or this player's
 * next one).
 *
 * Resilient to the tab being backgrounded (screen lock, app switch) while
 * idling -- mobile browsers throttle/freeze setTimeout and
 * requestAnimationFrame then, so a visibilitychange check reconciles the
 * wall-clock deadline on resume rather than trusting a timer that may have
 * silently failed to fire while frozen.
 */
export const AutoEndTurnNotice: React.FC<AutoEndTurnNoticeProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const { active: diceActive } = useModal();
  const endTurnReady = useEndTurnReady();
  const screen = useScreen();
  const player = gameState.activePlayer;

  // A plain ref, not state: a tap on the cancel button is a native
  // pointerdown (the document-level activity listener below, capture
  // phase) followed by a SEPARATE React synthetic click (handleCancelClick)
  // -- two independent event dispatches for the same tap, not guaranteed to
  // land in the same render/batch. Reading cancelled from state left a
  // window where a render could recompute `eligible` against a value that
  // hadn't caught up yet; a ref has no such window, since every read is the
  // actual current value, synchronously, with no commit to wait on.
  const cancelledRef = useRef(false);
  const [, forceRender] = useState(0);

  const [showing, setShowing] = useState(false); // past the silent warmup -- gauge is mounted
  const [active, setActive] = useState(false); // drives the gauge's CSS transition
  const [cycle, setCycle] = useState(0); // bumped on activity to restart both phases
  const lastPlayerIdRef = useRef<number | null>(null);
  // Always the latest props, read only once the timer actually fires --
  // the effect below intentionally doesn't depend on these, so a prop
  // identity change mid-countdown can't restart the gauge for no reason.
  const gameStateRef = useRef(gameState);
  const updateGameStateRef = useRef(updateGameState);
  gameStateRef.current = gameState;
  updateGameStateRef.current = updateGameState;

  // A new turn always re-arms the feature, even if it was cancelled last
  // time -- done directly during render (a plain ref mutation, not a side
  // effect) rather than in a useEffect, so the reset is visible to
  // `eligible` below in this SAME render instead of one render later.
  if (lastPlayerIdRef.current !== player.id) {
    lastPlayerIdRef.current = player.id;
    cancelledRef.current = false;
  }

  // A claimable tile under the player's feet is an unmade decision, even
  // though nothing here shows it as a screen (the Current Tile card isn't
  // one -- see utils/screenStore.ts) -- the game is still waiting on them.
  const awaitingClaimDecision = canClaimTile(gameState.activeTile, player);
  const eligible =
    endTurnReady &&
    !diceActive &&
    !screen &&
    !awaitingClaimDecision &&
    isLocalHuman(player) &&
    !cancelledRef.current;

  useEffect(() => {
    if (!eligible) {
      // Reset now, not just the timers/listener below -- otherwise a stale
      // showing/active=true from an interrupted cycle (e.g. the player got
      // sent to Prison mid-drain) lingers in state while hidden, and the
      // next render after becoming eligible again paints one frame of an
      // already-shown, already-drained gauge before this effect gets a
      // chance to fix it.
      setShowing(false);
      setActive(false);
      return;
    }

    setShowing(false);
    setActive(false);

    // Only assigned once the silent warmup actually elapses -- the cleanup
    // below checks for that before trying to cancel either.
    let raf: number | undefined;
    let fireTimer: ReturnType<typeof setTimeout> | undefined;

    // Absolute wall-clock deadlines, not just the relative setTimeout delays
    // below -- mobile browsers throttle or outright freeze setTimeout/rAF
    // while a tab is backgrounded or the screen locks, which is exactly when
    // a player is likeliest to be idling. The visibilitychange handler below
    // re-checks these against Date.now() whenever the tab wakes back up, so
    // a turn that should already have ended still does, even if the timer
    // meant to fire it got frozen mid-flight instead (the bug this guards
    // against: the gauge's CSS visually jumps to "done" on resume -- a
    // transition has no concept of being paused -- while the setTimeout
    // that was actually supposed to call endTurn() never fired at all).
    const showAt = Date.now() + WARMUP_MS;
    const fireAt = showAt + DURATION_MS;

    const fire = () => {
      gameEvent('setPhase', 'before-move');
      gameEvent('displayTile', {});
      endTurn(gameStateRef.current, updateGameStateRef.current);
    };

    const startVisiblePhase = () => {
      setShowing(true);
      raf = requestAnimationFrame(() => setActive(true));
      fireTimer = setTimeout(fire, DURATION_MS);
    };

    const warmupTimer = setTimeout(startVisiblePhase, WARMUP_MS);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now >= fireAt) {
        // Past the full deadline -- don't trust the frozen timers to still
        // fire correctly on their own; end the turn right now instead.
        clearTimeout(warmupTimer);
        if (fireTimer !== undefined) clearTimeout(fireTimer);
        if (raf !== undefined) cancelAnimationFrame(raf);
        fire();
      } else if (now >= showAt && fireTimer === undefined) {
        // Warmup elapsed while backgrounded, but the visible phase's own
        // setTimeout got frozen before it could start -- start it fresh now
        // (a full, correct DURATION_MS countdown) rather than trust a timer
        // that already proved unreliable once this cycle.
        clearTimeout(warmupTimer);
        startVisiblePhase();
      }
    };

    document.addEventListener('visibilitychange', onVisible);

    // Capture phase so this sees the click before a tile/screen handler
    // further down the tree can stop its own propagation -- which also
    // means it fires for a tap on the gauge's OWN cancel button before
    // handleCancelClick's stopPropagation ever runs (that only stops
    // React's synthetic event, not this native capture-phase listener that
    // already ran). A bumped cycle from that tap is harmless today --
    // cancelled still wins on the next render, since eligible checks it
    // too -- but it's needless churn riding along with a cancel that's
    // about to tear this whole effect down anyway, so it's excluded
    // explicitly rather than left to depend on that ordering.
    const onActivity = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.auto-end-turn-badge')) return;
      setCycle((c) => c + 1);
    };

    document.addEventListener('pointerdown', onActivity, true);

    return () => {
      clearTimeout(warmupTimer);
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (fireTimer !== undefined) clearTimeout(fireTimer);
      document.removeEventListener('pointerdown', onActivity, true);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [eligible, cycle]);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelledRef.current = true;
    // Refs don't trigger a re-render on their own -- this is what makes the
    // new value actually take effect (eligible gets recomputed against it
    // on the forced render, tearing the countdown's effect down).
    forceRender((n) => n + 1);
  };

  if (!showing) return null;

  return (
    <div className={`auto-end-turn-notice${active ? ' auto-end-turn-notice-active' : ''}`}>
      <button type="button" className="auto-end-turn-badge" onClick={handleCancelClick}>
        <svg className="auto-end-turn-gauge" viewBox="0 0 48 48">
          <circle className="auto-end-turn-gauge-track" cx="24" cy="24" r={RADIUS} />
          <circle
            className="auto-end-turn-gauge-ring"
            cx="24"
            cy="24"
            r={RADIUS}
            style={
              {
                strokeDasharray: CIRCUMFERENCE,
                strokeDashoffset: active ? CIRCUMFERENCE : 0,
                '--auto-end-turn-duration': `${DURATION_MS}ms`,
              } as React.CSSProperties
            }
          />
          <text x="24" y="30" className="auto-end-turn-gauge-flag" textAnchor="middle">
            🚩
          </text>
        </svg>
        <span className="auto-end-turn-label">
          {t('autoEndTurn.label')}
          <br />
          <span className="auto-end-turn-cancel-hint">{t('autoEndTurn.cancelHint')}</span>
        </span>
      </button>
    </div>
  );
};

export default AutoEndTurnNotice;
