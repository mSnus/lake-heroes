import React from 'react';
import '../styles/Gold.css';

interface GoldProps {
  amount: number | string;
  /** Which side of the amount the coin icon sits on. Default 'after',
   * matching how 🟡 already trailed the amount at nearly every site this
   * replaces. */
  where?: 'before' | 'after';
}

/**
 * Inline gold amount + coin icon, replacing the 🟡 emoji with the drawn
 * coin sprite everywhere an amount is actually displayed (the map's player
 * stats, the Tile Card, hire/upgrade screens...). Toasts and game-log
 * messages keep the plain 🟡 emoji -- they're plain text, not JSX, and
 * stay as-is deliberately (see actions/*.ts and the i18n locale files).
 *
 * `<Gold .../>`, capitalized, is JSX's own requirement for a component tag
 * -- a lowercase `gold` would be parsed as a literal HTML element instead.
 */
export const Gold: React.FC<GoldProps> = ({ amount, where = 'after' }) => {
  const icon = <img src="assets/sprites/coin3.svg" alt="🟡" className="gold-icon" />;
  return (
    <div className="gold-inline">
      {where === 'before' && icon}
      {amount}
      {where === 'after' && icon}
    </div>
  );
};

export default Gold;
