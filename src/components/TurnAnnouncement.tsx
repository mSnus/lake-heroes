import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { useModal } from '../utils/diceStore';
import { DecoratedButton } from './DecoratedButton';
import { PlayerLabel } from './PlayerLabel';
import { tJsx } from '../i18n/tJsx';
import { useLanguage } from '../i18n';
import '../styles/TurnAnnouncement.css';

const VISIBLE_MS = 2000;

interface TurnAnnouncementProps {
  gameState: GameState;
}

/**
 * A small decorated pop-up over the middle of the screen announcing whose
 * turn it is. Shows once per turn change (including the very first turn),
 * then disappears on its own after VISIBLE_MS -- or immediately once the
 * player starts rolling the dice, whichever comes first.
 */
export const TurnAnnouncement: React.FC<TurnAnnouncementProps> = ({ gameState }) => {
  useLanguage(); // subscribe so a language switch re-renders the translated text
  const { rolling } = useModal();
  const [visible, setVisible] = useState(false);
  const lastPlayerIdRef = useRef<number | null>(null);
  const player = gameState.activePlayer;

  useEffect(() => {
    if (lastPlayerIdRef.current === player.id) return;
    lastPlayerIdRef.current = player.id;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [player.id]);

  useEffect(() => {
    if (rolling) setVisible(false);
  }, [rolling]);

  if (!visible) return null;

  return (
    <div className="turn-announcement">
      <DecoratedButton className="turn-announcement-badge" tabIndex={-1}>
        <span>{tJsx('turnAnnouncement.text', { playerName: <PlayerLabel player={player} bold /> })}</span>
      </DecoratedButton>
    </div>
  );
};

export default TurnAnnouncement;
