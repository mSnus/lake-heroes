import React from 'react';
import { isMobileLayout } from './board/common';

interface SpriteCircleIconProps {
  src: string;
  size?: string;
}

/**
 * A sprite image cropped into a circle, used as the icon under a screen
 * title (encounter screens, tile claim, etc).
 */
export const SpriteCircleIcon: React.FC<SpriteCircleIconProps> = ({ src, size = isMobileLayout() ? '30vw' : '6rem' }) => (  
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      marginBottom: '16px',
      flexShrink: 0,
      zIndex: 6000,
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}
  />
);

export default SpriteCircleIcon;
