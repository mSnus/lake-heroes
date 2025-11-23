import React from 'react';

interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface GameMenuProps {
  title: React.ReactNode; // allow rich headers (e.g., colored circle + name)
  items: MenuItem[];
  children?: React.ReactNode;
}

export const GameMenu: React.FC<GameMenuProps> = ({ title, items, children }) => {
  return (
    <aside className="game-menu">
      <h3>{title}</h3>
      <div>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            disabled={item.disabled}
            style={{ display: 'block', margin: '8px 0', width: '100%' }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </aside>
  );
};
