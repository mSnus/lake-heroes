import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { useModal } from '../utils/diceStore';
import { DecoratedButton } from './DecoratedButton';
import { PlayerLabel } from './PlayerLabel';
import { playerTurnIncome } from '../game/income';
import { gameEvent } from '../utils/events';
import { tJsx } from '../i18n/tJsx';
import { useLanguage } from '../i18n';
import '../styles/TurnAnnouncement.css';

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
  useLanguage(); // subscribe so a language switch re-renders the translated text
  const { rolling } = useModal();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const lastPlayerIdRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const player = gameState.activePlayer;
  const turnIncome = playerTurnIncome(gameState, player);

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

  useEffect(() => {
    if (lastPlayerIdRef.current === player.id) return;
    lastPlayerIdRef.current = player.id;
    clearTimeout(hideTimerRef.current);
    clearTimeout(unmountTimerRef.current);
    setMounted(true);
    const raf = requestAnimationFrame(() => setActive(true));
    hideTimerRef.current = setTimeout(hide, VISIBLE_MS);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  useEffect(() => {
    if (rolling) hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {turnIncome.gold > 0 && <>+{turnIncome.gold}🟡 </>}
            {turnIncome.units > 0 && <>+{turnIncome.units}🧍</>}
          </span>
        )}
      </DecoratedButton>
    </div>
  );
};

export default TurnAnnouncement;
