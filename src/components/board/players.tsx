import React, { useRef, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';

import { TILE_COUNT, TILE_WIDTH, TILE_HEIGHT, getTilePosition, isMobileLayout } from './common';

export function drawPlayers(board, ctx) {
  // Switch layout for mobile: vertical (6x8) on mobile, horizontal (8x6) otherwise
  const isMobile = isMobileLayout();
  const ratioX = isMobile ? 1.8 : 1;
  const ratioY = isMobile ? 1.2 : 1;
  const tileWidth = TILE_WIDTH / ratioX;
  const tileHeight = TILE_HEIGHT / ratioY;

  board.players.forEach((player) => {
    const pos = player.position % TILE_COUNT;
    const { x, y } = getTilePosition(pos);
    const centerX = x + tileWidth / 2;
    const centerY = y + tileHeight / 2 + 30; // slightly lower than center

    // Draw player circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 9, 0, 2 * Math.PI);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw player name below
    ctx.font = '10px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, centerX, centerY + 20);
    ctx.textAlign = 'left';
  });
}
