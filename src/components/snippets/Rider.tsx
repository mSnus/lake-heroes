import React from 'react';

interface RiderProps {
  amount: number | string;
  where?: 'before' | 'after';
  color?: string;
}

// Only rider-blue.png exists today (see Militia, which has the full color
// set) -- callers still pass the player's real color, same as Militia, so
// this already works as more colors are dropped in. Until then, a missing
// color 404s onto rider-blue.png instead of showing a broken image.
export const Rider: React.FC<RiderProps> = ({ amount, where = 'after', color }) => {
  const icon = (
    <img
      src={`assets/sprites/rider-${color ?? 'blue'}.png`}
      alt="🐎"
      className="unit-icon"
    />
  );

  return (
    <div className="gold-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Rider;
