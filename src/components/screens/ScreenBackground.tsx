import React from 'react';
import '../../styles/screen.css';

interface ScreenBackgroundProps {
  image: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ image, style, children }) => (
  <div
    className='screen-common'
    style={{
      backgroundImage: `url(${image})`,
      ...style,
    }}
  >
    {children}
  </div>
);
