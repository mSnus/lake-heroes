import React from 'react';
import '../../styles/Icons.css';

interface GoldProps {
  amount: number | string;
  where?: 'before' | 'after';
}

export const Gold: React.FC<GoldProps> = ({ amount, where = 'after' }) => {
  const icon = <img src="assets/sprites/coin8.svg" alt="🟡" className="gold-icon" />;
  return (
    <div className="gold-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Gold;
