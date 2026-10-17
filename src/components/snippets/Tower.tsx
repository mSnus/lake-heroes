import React from 'react';
import '../../styles/Icons.css';

interface TowerProps {
  amount?: number | string;
  where?: 'before' | 'after';
}

export const Tower: React.FC<TowerProps> = ({ amount, where = 'after' }) => {
  const icon = <img src="assets/sprites/tower.svg" alt="🏯" className="tower-icon" />;
  return (
    <div className="tower-inline">
      {where === 'before' && icon}
      {amount ?? ''}
      {where === 'after' && icon}
    </div>
  );
};

export default Tower;
