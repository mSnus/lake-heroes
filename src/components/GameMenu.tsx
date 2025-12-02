import React from 'react';

export type MenuAction = 'roll-dice' | 'end-turn' | 'buy-tile' | 'fight' | 'pay-fee';

interface MenuItem {
  label: string;
  action: MenuAction;
  onClick: () => void;
  disabled?: boolean;
}

interface GameMenuProps {
  title?: string; // allow rich headers (e.g., colored circle + name)
  items: MenuItem[];
  children?: React.ReactNode;
}

export const GameMenu: React.FC<GameMenuProps> = ({ title, items, children }) => {
  function handleItemClick(item: MenuItem) {
    // Require action and validate it
    const action = item.action;
    if (!action) {
      throw new Error('MenuItem.action is required');
    }

    if (action === 'roll-dice') {
      // request dice widget to start rolling and set phase to 'rolling'
      window.dispatchEvent(new CustomEvent('startDiceRoll'));
      window.dispatchEvent(new CustomEvent('setPhase', { detail: 'rolling' }));
      // still call original handler to preserve behavior
      try {
        item.onClick();
      } catch {}
      return;
    }

    if (action === 'end-turn') {
      // update phase to before-move when ending turn
      window.dispatchEvent(new CustomEvent('setPhase', { detail: 'before-move' }));
    }

    // Default: execute item handler
    item.onClick();
  }

  return (
    <div className="game-menu">
      {title && <h3>{title}</h3>}
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
