import React from 'react';
import { Player } from '../game/Player';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { PlayerLabel } from './PlayerLabel';
import '../styles/PlayerCard.css';

interface PlayerCardProps {
  /** A real player; supplies the figure, name and colour. */
  player?: Player | null;
  /** Fallbacks for non-players (NPCs like the Dragon or ambushers). */
  name?: string;
  color?: string;
  /** Explicit image, used for NPCs or to override the player figure. */
  imageSrc?: string;
  /** Emoji shown before the name (e.g. ⚔️ for the attacker, 🛡️ for the defender). */
  prefix?: string;
  /** Shown after the name, e.g. an army-size dice bonus badge ("⚔️+1"). */
  suffix?: string;
  className?: string;
}

/**
 * Vertical card: a figure above a coloured name. Reuses {@link PlayerLabel} for
 * the name and is shared by the Battle and Ambush screens.
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  name,
  color,
  imageSrc,
  prefix,
  suffix,
  className,
}) => {
  const img = imageSrc ?? (player ? getPlayerImageSrc(player.image, player.fame) : undefined);
  const altName = player?.name ?? name ?? '';

  return (
    <div className={'player-card' + (className ? ' ' + className : '')}>
      {img && <img src={img} alt={altName} className="battle-player-icon" />}
      <div className="player-card-name">
        {prefix ? <span className="player-card-prefix">{prefix}</span> : null}
        <PlayerLabel player={player ?? undefined} name={name} color={color} bold />
        {suffix ? <span className="player-card-suffix">{suffix}</span> : null}
      </div>
    </div>
  );
};

export default PlayerCard;
