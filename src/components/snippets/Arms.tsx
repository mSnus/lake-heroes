import React from 'react';
import '../../styles/Icons.css';

interface ArmsProps {
  amount: number | string;
  where?: 'before' | 'after';
}

export const Arms: React.FC<ArmsProps> = ({ amount, where = 'after' }) => {
  const icon = (
    <span className="defence-icon">
      <img
        src={`assets/sprites/defence.svg`}
        alt={'️⚔'}
        className={`unit-icon`}
      />
    </span>
  );
  return (
    <div className="arms-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Arms;
