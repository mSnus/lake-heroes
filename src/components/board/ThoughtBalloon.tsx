import React, { useEffect, useState } from 'react';
import { GameState } from '../../game/GameState';
import { useT } from '../../i18n';
import '../../styles/ThoughtBalloon.css';

const THOUGHT_BEFORE_ROLL_MS = 5000;
const THOUGHT_AFTER_ROLL_MS = 7000;
const THOUGHT_COUNT = 13;

/** A random thought for a human player who idles: 5s without rolling, or 7s after the roll.
 * One at a time; it goes with the turn. */
export function useIdleThought(board: GameState): string | null {
  const t = useT();
  const turnKey = `${board.round}-${board.activePlayerIndex}`;
  const rolled = board.turnPhase !== 'before-move';
  const watching = board.gameStarted && !board.harvest && !board.activePlayer?.isComputer;
  const [thought, setThought] = useState<{ turnKey: string; n: number } | null>(null);

  useEffect(() => {
    if (!watching) return;
    const id = setTimeout(
      () =>
        setThought((prev) => {
          let n = Math.floor(Math.random() * THOUGHT_COUNT);
          if (prev?.turnKey === turnKey && n === prev.n) n = (n + 1) % THOUGHT_COUNT;
          return { turnKey, n };
        }),
      rolled ? THOUGHT_AFTER_ROLL_MS : THOUGHT_BEFORE_ROLL_MS
    );
    return () => clearTimeout(id);
  }, [turnKey, rolled, watching]);

  return thought && thought.turnKey === turnKey && watching ? t(`thoughts.t${thought.n + 1}`) : null;
}

interface Props {
  text: string;
  /** Near the map's top edge: hang below the sprite instead of above. */
  below: boolean;
  /** Near the map's right edge: grow to the left. */
  toLeft: boolean;
}

export function ThoughtBalloon({ text, below, toLeft }: Props) {
  return (
    <div className={'thought' + (below ? ' thought--below' : '') + (toLeft ? ' thought--left' : '')}>
      <svg className="thought-cloud" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="50" cy="30" rx="49" ry="29" />
      </svg>
      <svg className="thought-tail" viewBox="0 0 24 24" aria-hidden>
        <circle cx="17" cy="6" r="5" />
        <circle cx="6" cy="18" r="3" />
      </svg>
      <span className="thought-text">{text}</span>
    </div>
  );
}
