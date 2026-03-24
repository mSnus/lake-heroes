import React from 'react';

interface FadeProps {
  children?: React.ReactNode;
  amount?: number;
}

export const Fade: React.FC<FadeProps> = ({ children, amount }) => (
  <div
    className='fade'
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 5501,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      ...(amount !== undefined ? { opacity: amount } : {}),
    }}

  >
    {children}
  </div>
);
