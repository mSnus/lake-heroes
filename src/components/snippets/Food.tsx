import React from 'react';
import '../../styles/Icons.css';

interface FoodProps {
  amount: number | string;
  where?: 'before' | 'after';
}

export const Food: React.FC<FoodProps> = ({ amount, where = 'after' }) => {
  const icon = <span className="resource-icon">🥮</span>;
  return (
    <div className="food-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Food;
