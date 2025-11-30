import React from 'react';

type MenuActions = 
  | 'roll-dice'
  | 'end-turn'
  | 'buy-tile'
  | 'sell-tile'
  | 'upgrade-tile'
  | 'fight'
  | 'pay-fee';

interface MenuItem {
  label: string;
  action: MenuActions;
  onClick: () => void;
  disabled?: boolean;
}

interface GameMenuProps {
  title: React.ReactNode; // allow rich headers (e.g., colored circle + name)
  items: MenuItem[];
  children?: React.ReactNode;
}

export const GameMenu: React.FC<GameMenuProps> = ({ title, items, children }) => {
  const titleText = typeof title === 'string' ? title : undefined;


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
    <aside className="game-menu">
      {titleText && <h3>{titleText}</h3>}
      <div>
        {items.map((item, i) => {
          // Display label: normalize end-turn text for consistency
          const displayLabel = item.action === 'end-turn' ? 'End Turn' : item.label;
          return (
            <button
              key={i}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              style={{ display: 'block', margin: '8px 0', width: '100%' }}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </aside>
  );
};
