import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { useModal } from '../utils/diceStore';
import { useScreen } from '../utils/screenStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { isLocalHuman } from '../game/seats';
import { endTurn } from '../actions/endTurn';
import { gameEvent } from '../utils/events';
import { useT } from '../i18n';
import '../styles/AutoEndTurnNotice.css';

const DURATION_MS = 3000;
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface AutoEndTurnNoticeProps {
  gameState: GameState;
  updateGameState: (board: GameState) => void;
}

/**
 * Auto-ends the turn after DURATION_MS of inactivity, once there's nothing
 * left to decide -- the same readiness the 🚩 End Turn button itself gates
 * on (see ShieldColumn's canEndTurn), and only for a seat this browser plays
 * in person (never a bot's, which BotController already drives on its own).
 *
 * Shown as a radial gauge, same screen position/style family as
 * TurnAnnouncement, draining over DURATION_MS and ending the turn the
 * instant it empties. Any click anywhere -- the map, a tile, a player icon,
 * opening a screen, starting a dice roll -- resets the idle clock and hides
 * it (it only ever shows DURING an uninterrupted idle stretch, never
 * before); tapping the notice itself instead cancels auto-end-turn for the
 * rest of this turn specifically, re-arming automatically once it's someone
 * else's turn (or this player's next one).
 */
export const AutoEndTurnNotice: React.FC<AutoEndTurnNoticeProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const { active: diceActive } = useModal();
  const endTurnReady = useEndTurnReady();
  const screen = useScreen();
  const player = gameState.activePlayer;

  const [cancelled, setCancelled] = useState(false);
  const [active, setActive] = useState(false); // drives the gauge's CSS transition
  const [cycle, setCycle] = useState(0); // bumped on activity to restart the countdown
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

  const eligible = endTurnReady && !diceActive && !screen && isLocalHuman(player) && !cancelled;

  useEffect(() => {
    if (!eligible) return;

    setActive(false);
    const raf = requestAnimationFrame(() => setActive(true));
    const timer = setTimeout(() => {
      gameEvent('setPhase', 'before-move');
      gameEvent('displayTile', {});
      endTurn(gameStateRef.current, updateGameStateRef.current);
    }, DURATION_MS);

    // Capture phase so this sees the click before a tile/screen handler
    // further down the tree can stop its own propagation.
    const onActivity = () => setCycle((c) => c + 1);
    document.addEventListener('pointerdown', onActivity, true);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onActivity, true);
    };
  }, [eligible, cycle]);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelled(true);
  };

  if (!eligible) return null;

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
