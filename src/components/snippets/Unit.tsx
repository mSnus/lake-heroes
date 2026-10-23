import React from 'react';

export interface UnitProps {
  amount: number | string;
  maxAmount?: string;
  where?: 'before' | 'after';
  color?: string;
  spriteType?: string;
  altEmoji?: string;
}

export const Unit: React.FC<UnitProps> = ({ amount, where = 'after', maxAmount, color, altEmoji = '🧍', spriteType = 'militia' }) => {
  const icon = (
    <img
      src={`assets/sprites/${spriteType}-${color ?? 'red'}.png`}
      alt={altEmoji}
      className={`unit-icon unit-${spriteType}`}
    />
  );

  return (
    <div className="unit-inline">
      {where === 'before' && icon}
      {amount}
      {maxAmount && <sup className={'unit-max-amount'}>{maxAmount}</sup>}
      {where === 'after' && icon}
    </div>
  );
};

export default Unit;
