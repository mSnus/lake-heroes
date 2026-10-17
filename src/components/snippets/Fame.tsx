import React from 'react';

interface FameProps {
  amount: number | string;
  where?: 'before' | 'after';
}

export const Fame: React.FC<FameProps> = ({ amount, where = 'after' }) => {
  const icon = (
    <img src="assets/sprites/trophy3.svg" alt="🏆" className="fame-icon" />
  );

  return (
    <div className="fame-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Fame;
