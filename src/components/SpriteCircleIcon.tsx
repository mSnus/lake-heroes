import React from 'react';

interface SpriteCircleIconProps {
  src: string;
  size?: string;
}

/**
 * A sprite image cropped into a circle, used as the icon under a screen
 * title (encounter screens, tile claim, etc).
 */
export const SpriteCircleIcon: React.FC<SpriteCircleIconProps> = ({ src, size = '30vw' }) => (
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
