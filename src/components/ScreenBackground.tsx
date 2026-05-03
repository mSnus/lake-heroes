import React from 'react';

interface ScreenBackgroundProps {
  image: string;
  children?: React.ReactNode;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({ image, children }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 5500,
      backgroundImage: `url(${image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'screenFadeIn 0.4s ease',
    }}
  >
    {children}
  </div>
);
