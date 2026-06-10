import React from 'react';
import { Player } from '../game/Player';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import '../styles/PlayerLabel.css';

interface PlayerLabelProps {
  /** The player to label. Supplies name, color and (for the image) figure. */
  player?: Player | null;
  /** Fallbacks when no Player object is available (e.g. encounter configs). */
  name?: string;
  color?: string;
  /** Show the player's figure before the name (requires a `player`). */
  showImage?: boolean;
  /** Render the name as <strong> instead of <span>. */
  bold?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a player's name in their colour, optionally preceded by their figure.
 * The single place that knows how to present a player inline — look players up
 * by id elsewhere and hand the resolved Player here.
 */
export const PlayerLabel: React.FC<PlayerLabelProps> = ({
  player,
  name,
  color,
  showImage = false,
  bold = false,
  className,
  style,
}) => {
  const displayName = player?.name ?? name ?? '';
  const displayColor = player?.color ?? color;
  const NameTag = bold ? 'strong' : 'span';

  return (
    <span className={'player-label' + (className ? ' ' + className : '')} style={style}>
      {showImage && player && (
        <img
          className="player-label-img"
          src={getPlayerImageSrc(player.image, player.fame)}
          alt={displayName}
        />
      )}
      <NameTag style={{ color: displayColor }}>{displayName}</NameTag>
    </span>
  );
};

export default PlayerLabel;
