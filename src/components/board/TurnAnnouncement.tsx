import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../../game/GameState';
import { useModal, startDiceRoll } from '../../utils/diceStore';
import { DecoratedButton } from '../ui/DecoratedButton';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { playerTurnIncome } from '../../game/income';
import { gameEvent } from '../../utils/events';
import { tJsx } from '../../i18n/tJsx';
import { useT } from '../../i18n';
import { FORK_START_INDEX } from '../../game/constants';
import { setForkChoice } from '../../utils/forkChoiceStore';
import { SELECTED_COLOR, ANGLE_LEFT, ANGLE_RIGHT } from './BoardCanvas';
import '../../styles/TurnAnnouncement.css';

const VISIBLE_MS = 2000;
const TRANSITION_MS = 500;

interface TurnAnnouncementProps {
  gameState: GameState;
}

/**
 * A small decorated pop-up over the middle of the screen announcing whose
 * turn it is. Shows once per turn change (including the very first turn),
 * then disappears on its own after VISIBLE_MS -- or immediately once the
 * player starts rolling the dice, whichever comes first. Fades in and out
 * over TRANSITION_MS rather than popping in/out abruptly.
 */
export const TurnAnnouncement: React.FC<TurnAnnouncementProps> = ({ gameState }) => {
  const t = useT(); // also subscribes so a language switch re-renders the translated text
  const { rolling } = useModal();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const lastPlayerIdRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const player = gameState.activePlayer;
  const turnIncome = playerTurnIncome(gameState, player);
  // A human standing on the fork's start tile, about to roll -- the
  // announcement stays up (no auto-hide) and grows a "Go left"/"Go right"
  // path picker instead, closing only once one of those is clicked. An AI at
  // the same spot picks its own path elsewhere (see ai/decisions.ts's
  // pickForkChoice, called from BotController) and gets the normal
  // auto-closing announcement -- no buttons to click.
  const atFork =
    !player.isComputer &&
    gameState.turnPhase === 'before-move' &&
    player.position === FORK_START_INDEX;

  const hide = () => {
    clearTimeout(hideTimerRef.current);
    setActive(false);
    // Fires once the plate has actually finished fading out (not when the
    // fade starts) -- other panels (e.g. CurrentPlayer's gold/army reveal)
    // wait for this before showing this turn's income, so the numbers don't
    // change while the plate announcing whose turn it is is still on screen.
    unmountTimerRef.current = setTimeout(() => {
      setMounted(false);
      gameEvent('turnAnnouncementGone', player.id);
    }, TRANSITION_MS);
  };

  const choosePath = (choice: 'short' | 'long') => {
    setForkChoice(choice);
    hide();
    // The dice modal is already active by the time the fork buttons can show
    // (beginTurn fires 'showDice' before the player ever reaches this screen)
    // -- picking a path rolls immediately instead of waiting for a tap on
    // the die.
    startDiceRoll();
  };

  useEffect(() => {
    if (lastPlayerIdRef.current === player.id) return;
    lastPlayerIdRef.current = player.id;
    clearTimeout(hideTimerRef.current);
    clearTimeout(unmountTimerRef.current);
    setMounted(true);
    const raf = requestAnimationFrame(() => setActive(true));
    // Non-autoclosing at the fork -- stays up until the player picks a path
    // (see choosePath) instead of disappearing on its own.
    if (!atFork) hideTimerRef.current = setTimeout(hide, VISIBLE_MS);
    return () => cancelAnimationFrame(raf);
  }, [player.id]);

  useEffect(() => {
    if (rolling) hide();
  }, [rolling]);

  useEffect(() => () => {
    clearTimeout(hideTimerRef.current);
    clearTimeout(unmountTimerRef.current);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`turn-announcement${active ? ' turn-announcement-active' : ''}`}>
      <DecoratedButton
        className="turn-announcement-badge"
        tabIndex={-1}
        style={{ fontWeight: 'normal' }}
      >
        <span>
          {tJsx('turnAnnouncement.text', { playerName: <PlayerLabel player={player}/> })}
        </span>
        {(turnIncome.gold > 0 || turnIncome.units > 0) && (
          <span className="turn-announcement-income">
            {turnIncome.gold > 0 && (
              <>
                +<Gold amount={turnIncome.gold} />{' '}
              </>
            )}
            {turnIncome.units > 0 && <>+{turnIncome.units}🧍</>}
          </span>
        )}
      </DecoratedButton>
      {/* Own row below the (non-clickable) badge -- DecoratedButton renders a
          real <button>, and nesting these inside it would be invalid HTML
          (button-in-button) as well as visually cramped, so these are plain
          buttons rather than DecoratedButtons. */}
      {atFork && (
        <div className="turn-announcement-fork-buttons">
          <button
            type="button"
            className="turn-announcement-fork-button"
            onClick={() => choosePath('short')}
          >
            <span
              className="turn-announcement-fork-arrow"
              style={{ color: SELECTED_COLOR, transform: `rotate(${ANGLE_LEFT}deg)` }}
            >
              ➜
            </span>
            {t('turnAnnouncement.goLeft')}
          </button>
          <button
            type="button"
            className="turn-announcement-fork-button"
            onClick={() => choosePath('long')}
          >
            <span
              className="turn-announcement-fork-arrow"
              style={{ color: SELECTED_COLOR, transform: `rotate(${ANGLE_RIGHT}deg)` }}
            >
              ➜
            </span>
            {t('turnAnnouncement.goRight')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TurnAnnouncement;
