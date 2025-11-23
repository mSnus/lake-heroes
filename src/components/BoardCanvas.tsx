import React, { useRef, useEffect } from 'react';
import { Board } from '../game/Board';

interface BoardCanvasProps {
  board: Board;
}

const TILE_COUNT = 20;
const BOARD_WIDTH = 7; // horizontal tiles
const BOARD_HEIGHT = 5; // vertical tiles
const TILE_WIDTH = 80;
const TILE_HEIGHT = 60;
const CANVAS_WIDTH = BOARD_WIDTH * TILE_WIDTH;
const CANVAS_HEIGHT = BOARD_HEIGHT * TILE_HEIGHT;

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Extract emoji and text parts from tile name
  function parseTileName(name: string): { emoji: string; textPart1: string; textPart2: string } {
    // Find where text starts (first letter or number after potential emoji)
    let textStart = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name[i];
      const code = char.charCodeAt(0);
      // Check if it's a letter (A-Z, a-z) or number (0-9)
      if (
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57)
      ) {
        textStart = i;
        break;
      }
    }
    const emoji = name.substring(0, textStart).trim();
    const text = name.substring(textStart).trim();

    // Split text by space
    const spaceIndex = text.indexOf(' ');
    const textPart1 = spaceIndex > 0 ? text.substring(0, spaceIndex) : text;
    const textPart2 = spaceIndex > 0 ? text.substring(spaceIndex + 1) : '';

    return { emoji, textPart1, textPart2 };
  }

  // Calculate tile position in rectangular path (7x5 = 20 tiles)
  function getTilePosition(tileIndex: number): { x: number; y: number } {
    const i = tileIndex % TILE_COUNT;
    // Top row: 0-6 (7 tiles, left to right)
    if (i < BOARD_WIDTH) {
      return { x: i * TILE_WIDTH, y: 0 };
    }
    // Right side: 7-10 (4 tiles, top to bottom, excluding top-right corner)
    if (i < BOARD_WIDTH + BOARD_HEIGHT - 1) {
      const rightIndex = i - BOARD_WIDTH;
      return { x: (BOARD_WIDTH - 1) * TILE_WIDTH, y: (rightIndex + 1) * TILE_HEIGHT };
    }
    // Bottom row: 11-16 (6 tiles, right to left, excluding bottom-right corner)
    if (i < BOARD_WIDTH + BOARD_HEIGHT - 1 + BOARD_WIDTH - 1) {
      const bottomIndex = i - (BOARD_WIDTH + BOARD_HEIGHT - 1);
      return {
        x: (BOARD_WIDTH - 2 - bottomIndex) * TILE_WIDTH,
        y: (BOARD_HEIGHT - 1) * TILE_HEIGHT,
      };
    }
    // Left side: 17-19 (3 tiles, bottom to top, excluding both corners)
    const leftIndex = i - (BOARD_WIDTH + BOARD_HEIGHT - 1 + BOARD_WIDTH - 1);
    return {
      x: 0,
      y: (BOARD_HEIGHT - 2 - leftIndex) * TILE_HEIGHT,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw tiles
    for (let i = 0; i < TILE_COUNT; i++) {
      const { x, y } = getTilePosition(i);
      const tile = board.tiles[i];

      // Draw tile background
      ctx.fillStyle = tile?.owner
        ? board.players.find((p) => p.name === tile.owner)?.color + '33' || '#ffffff'
        : '#ffffff';
      ctx.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);

      // Draw tile border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, TILE_WIDTH, TILE_HEIGHT);

      // Draw tile number
      ctx.font = '10px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillText(String(i + 1), x + 2, y + 12);

      // Draw tile name in 3 lines: emoji, text part 1, text part 2
      if (tile?.name) {
        const { emoji, textPart1, textPart2 } = parseTileName(tile.name);
        const centerX = x + TILE_WIDTH / 2;
        let currentY = y + 20;

        // Line 1: Emoji (bigger font)
        if (emoji) {
          ctx.font = '22px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(emoji, centerX, currentY);
          currentY += 20;
        }

        // Line 2: First part of text
        if (textPart1) {
          ctx.font = '9px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(textPart1, centerX, currentY);
          currentY += 12;
        }

        // Line 3: Second part of text (if exists)
        if (textPart2) {
          ctx.font = '9px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(textPart2, centerX, currentY);
        }

        // Reset text alignment
        ctx.textAlign = 'left';
      }
    }

    // Draw player tokens
    board.players.forEach((player) => {
      const pos = player.position % TILE_COUNT;
      const { x, y } = getTilePosition(pos);
      const centerX = x + TILE_WIDTH / 2;
      const centerY = y + TILE_HEIGHT / 2;

      // Draw player circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw player name below
      ctx.font = '9px Arial';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, centerX, centerY + 20);
      ctx.textAlign = 'left';
    });
  }, [board]);

  return <canvas width={CANVAS_WIDTH} height={CANVAS_HEIGHT} ref={canvasRef} />;
};
