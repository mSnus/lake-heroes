import React from 'react';
import '../styles/screen.css';

interface ScreenBackgroundProps {
  image: string;
  children?: React.ReactNode;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ image, children }) => (
  <div
    className='screen-common'
    style={{
      backgroundImage: `url(${image})`,
    }}
  >
    {children}
  </div>
);
