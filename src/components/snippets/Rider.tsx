import React from 'react';
import Unit, { type UnitProps } from './Unit';

export const Rider: React.FC<UnitProps> = (props) => {
  return <Unit {...props} spriteType="rider" altEmoji="🐎" />;
};

export default Rider;
