import React from 'react';
import { karmaEmoji } from '../../utils/karma';

/** A player's karma as emoji + value (🕷️-2, 🕊️1, 🌈4); nothing at 0. */
export const Karma: React.FC<{ karma: number }> = ({ karma }) =>
  karma === 0 ? null : (
    <span className="karma-label">
      {karmaEmoji(karma)}
      {karma}
    </span>
  );

export default Karma;
