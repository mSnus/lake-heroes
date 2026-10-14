import React from 'react';
import { isMobileLayout } from './board/common';

interface SpriteCircleIconProps {
  src: string;
  size?: string;
  style?: React.CSSProperties;
}

/**
 * A sprite image cropped into a circle, used as the icon under a screen
 * title (encounter screens, tile claim, etc).
 */
export const SpriteCircleIcon: React.FC<SpriteCircleIconProps> = ({
  src,
  size = isMobileLayout() ? '30vw' : '6rem',
  style = null,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      marginBottom: '16px',
      flexShrink: 0,
      zIndex: 6000,
      backgroundImage: `url('assets/sprites/ring.png'), url(${src})`,
      backgroundBlendMode: 'luminosity',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      ...style,
    }}
  />
);

export default SpriteCircleIcon;
