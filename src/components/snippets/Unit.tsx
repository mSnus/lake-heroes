import React from 'react';

export interface UnitProps {
  amount: number | string;
  maxAmount?: string;
  where?: 'before' | 'after';
  color?: string;
  spriteType?: string;
  altEmoji?: string;
  /** A Knight's militia are footmen, not militia -- riders are unaffected. */
  knight?: boolean;
}

export const Unit: React.FC<UnitProps> = ({
  amount,
  where = 'after',
  maxAmount,
  color,
  altEmoji = '🧍',
  spriteType = 'militia',
  knight = false,
}) => {
  const effectiveSpriteType = knight && spriteType === 'militia' ? 'footman' : spriteType;
  const icon = (
    <img
      src={`assets/sprites/${effectiveSpriteType}-${color ?? 'grey'}.png`}
      alt={altEmoji}
      className={`unit-icon unit-${effectiveSpriteType}`}
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
