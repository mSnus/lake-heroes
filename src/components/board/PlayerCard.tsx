import React from 'react';
import { Player } from '../../game/Player';
import { getPlayerImageSrc } from '../../game/PlayerOptions';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { getArtifact } from '../../game/artifacts';
import { say, sayLocal } from '../../utils/say';
import '../../styles/PlayerCard.css';

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
  /** Restricts the artifact badges shown to these ids (e.g. only artifacts with an active bonus this battle). Omit to show all owned artifacts. */
  artifactIds?: string[];
  /** Set to false to hide the artifacts row entirely (e.g. when it's shown elsewhere already). Defaults to true. */
  showArtifacts?: boolean;
  /** Rendered ahead of the artifacts, sharing their row -- the King's
   * contracts on the player card (see CurrentPlayerCard). The row appears
   * for these even when there are no artifacts to put beside them. */
  extraBadges?: React.ReactNode;
  className?: string;
  /** Fires when the portrait image itself (not the whole card) is clicked --
   * used by BattleScreen to export the live battle state as JSON. Omitted
   * everywhere else. */
  onIconClick?: () => void;
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
  artifactIds,
  showArtifacts = true,
  extraBadges,
  className,
  onIconClick,
}) => {
  const img = imageSrc ?? (player ? getPlayerImageSrc(player.image, player.isKnight) : undefined);
  // The player's color key, not their name -- PlayerLabel right below
  // already shows the name as visible text, and some copy/accessibility
  // paths pull alt text in too, doubling it on a plain-text copy. NPCs
  // (dragon, ambushers, ...) have no color key, so they keep their label.
  const altName = player ? player.image : (name ?? '');
  const visibleArtifacts =
    player && showArtifacts
      ? artifactIds
        ? player.artifacts.filter((id) => artifactIds.includes(id))
        : player.artifacts
      : [];

  return (
    <div className={'player-card' + (className ? ' ' + className : '')}>
      {img && (
        <img
          src={img}
          alt={altName}
          className="battle-player-icon"
          onClick={onIconClick}
          style={onIconClick ? { cursor: 'pointer' } : undefined}
        />
      )}
      <div className="player-card-name">
        {prefix ? <span className="player-card-prefix">{prefix}</span> : null}
        <PlayerLabel player={player ?? undefined} name={name} color={color} bold />
        {suffix ? <span className="player-card-suffix">{suffix}</span> : null}
      </div>
      {/* Children.count, not a plain truthiness check: an empty array is
          truthy, which would leave a blank badge row (and the card's gap
          with it) on every player who has none. */}
      {(visibleArtifacts.length > 0 || React.Children.count(extraBadges) > 0) && (
        <div className="player-card-artifacts">
          {extraBadges}
          {visibleArtifacts.map((id) => {
            const artifact = getArtifact(id);
            if (!artifact) return null;
            return (
              <span
                key={id}
                className="player-card-artifact-badge"
                onClick={() => sayLocal(`${artifact.name}: ${artifact.description}`, 'info')}
                style={{ cursor: 'pointer' }}
              >
                {artifact.emoji}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlayerCard;
