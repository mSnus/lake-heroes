import React from 'react';
import { isMobileLayout } from '../board/common';

interface SpriteCircleIconProps {
  src: string;
  size?: string;
  style?: React.CSSProperties;
  /** Skips the gilded ring overlay -- for a screen whose own art already
   * frames the sprite (e.g. the caravan screen's circle backdrop). */
  noRing?: boolean;
}

/**
 * A sprite image cropped into a circle, used as the icon under a screen
 * title (encounter screens, tile claim, etc).
 */
export const SpriteCircleIcon: React.FC<SpriteCircleIconProps> = ({
  src,
  size = isMobileLayout() ? '30vw' : '6rem',
  style = null,
  noRing = false,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      marginBottom: '16px',
      flexShrink: 0,
      zIndex: 6000,
      backgroundImage: noRing ? `url(${src})` : `url('assets/sprites/ring.png'), url(${src})`,
      backgroundBlendMode: noRing ? 'normal' : 'luminosity',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      ...style,
    }}
  />
);

export default SpriteCircleIcon;
