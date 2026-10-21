import React from 'react';

interface MilitiaProps {
  amount: number | string;
  where?: 'before' | 'after';
  color?: string;
}

export const Militia: React.FC<MilitiaProps> = ({ amount, where = 'after', color }) => {
  const icon = (
    <img
      src={`assets/sprites/militia-${color ?? 'red'}.png`}
      alt="🧍"
      className="unit-icon unit-militia"
    />
  );

  return (
    <div className="unit-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Militia;
