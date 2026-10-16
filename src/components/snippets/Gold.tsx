import React from 'react';
import '../../styles/Icons.css';

interface GoldProps {
  amount: number | string;
  /** Which side of the amount the coin icon sits on. Default 'after',
   * matching how 🟡 already trailed the amount at nearly every site this
   * replaces. */
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
