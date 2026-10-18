import React from 'react';
import '../../styles/screen.css';

interface ScreenBackgroundProps {
  image: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({
  image,
  style,
  children,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}) => (
  <div
    className='screen-common'
    style={{
      backgroundImage: `url(${image})`,
      ...style,
    }}
    onPointerDown={onPointerDown}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
  >
    {children}
  </div>
);
