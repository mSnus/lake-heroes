import React from 'react';
import Unit, { type UnitProps } from './Unit';

export const Militia: React.FC<UnitProps> = (props) => {
  return <Unit {...props} spriteType="militia" altEmoji="🧍" />;
};

export default Militia;
