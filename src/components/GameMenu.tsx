import React from 'react';
import { gameEvent } from '../utils/events';

export type MenuAction = 'roll-dice' | 'end-turn' | 'buy-tile' | 'fight' | 'pay-fee';

export interface MenuItem {
  label: string;
  action: MenuAction;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

interface GameMenuProps {
  items: MenuItem[];
  children?: React.ReactNode;
  top: string;
}

export const GameMenu: React.FC<GameMenuProps> = ({ items, children, top }) => {
  function handleItemClick(item: MenuItem) {
    if (item.action === 'end-turn') {
      // update phase to before-move when ending turn
      gameEvent('setPhase', 'before-move');
    }

    try {
      item.onClick();
    } catch {}
  }

  return (
    <div className="game-menu" style={{ top: top }}>
      <div>
        {items.map((item, i) => {
          return (
            <button
              key={i}
              className="game-menu-button"
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
};
