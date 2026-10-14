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
 */
export const AutoEndTurnNotice: React.FC<AutoEndTurnNoticeProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const { active: diceActive } = useModal();
  const endTurnReady = useEndTurnReady();
  const screen = useScreen();
  const player = gameState.activePlayer;

  const [cancelled, setCancelled] = useState(false);
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

  // A new turn always re-arms the feature, even if it was cancelled last time.
  useEffect(() => {
    if (lastPlayerIdRef.current === player.id) return;
    lastPlayerIdRef.current = player.id;
    setCancelled(false);
  }, [player.id]);

  // A claimable tile under the player's feet is an unmade decision, even
  // though nothing here shows it as a screen (the Current Tile card isn't
  // one -- see utils/screenStore.ts) -- the game is still waiting on them.
  const awaitingClaimDecision = canClaimTile(gameState.activeTile, player);
  const eligible =
    endTurnReady && !diceActive && !screen && !awaitingClaimDecision && isLocalHuman(player) && !cancelled;

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

    const warmupTimer = setTimeout(() => {
      setShowing(true);
      raf = requestAnimationFrame(() => setActive(true));
      fireTimer = setTimeout(() => {
        gameEvent('setPhase', 'before-move');
        gameEvent('displayTile', {});
        endTurn(gameStateRef.current, updateGameStateRef.current);
      }, DURATION_MS);
    }, WARMUP_MS);

    // Capture phase so this sees the click before a tile/screen handler
    // further down the tree can stop its own propagation.
    const onActivity = () => setCycle((c) => c + 1);
    document.addEventListener('pointerdown', onActivity, true);

    return () => {
      clearTimeout(warmupTimer);
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (fireTimer !== undefined) clearTimeout(fireTimer);
      document.removeEventListener('pointerdown', onActivity, true);
    };
  }, [eligible, cycle]);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelled(true);
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
