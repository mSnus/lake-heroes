import React, { useEffect, useState } from 'react';
import { SAFE_COLOR, stripHtml } from '../../utils/html';

interface NamedColor {
  name: string;
  color?: string;
}

/** The message as plain text, each player's name in their colour -- never parsed as HTML. */
function colouredNames(message: string, players: NamedColor[]): React.ReactNode[] {
  const named = players.filter((p) => p.name).sort((a, b) => b.name.length - a.name.length);
  if (!named.length) return [message];
  const pattern = new RegExp(`(${named.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return message.split(pattern).map((part, i) => {
    const player = named.find((p) => p.name === part);
    if (!player) return part;
    const color = player.color && SAFE_COLOR.test(player.color) ? player.color : undefined;
    return (
      <span key={i} style={{ color }}>
        {part}
      </span>
    );
  });
}

const GameMessage: React.FC<{ message: string; players?: NamedColor[] }> = ({ message, players = [] }) => {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [message]);

  if (!message || dismissed) return <div />;
  return (
    <div className="game-message" onClick={() => setDismissed(true)}>
      <div className="game-message-text">
        {/* One inline run: the box is a flex container, so loose parts would each become a column. */}
        <span>{colouredNames(stripHtml(message), players)}</span>
      </div>
    </div>
  );
};

export default GameMessage;
