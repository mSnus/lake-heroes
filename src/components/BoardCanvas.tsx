import React, { useRef, useEffect } from 'react';
import { Board } from '../game/Board';

interface BoardCanvasProps {
  board: Board;
}

const TILE_COUNT = 40;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw 40 tiles in a rectangular path
    // (just for placeholder: don't do actual math for 40 corners yet)
    for (let i = 0; i < TILE_COUNT; i++) {
      // Compute rough positions along the border
      let x = 50 + (i % 10) * 65;
      let y = i < 10 ? 50 : i < 20 ? 50 + (i - 10) * 50 : i < 30 ? 550 : 550 - (i - 30) * 50;
      if (i >= 20 && i < 30) x = 700 - (i - 20) * 65;
      if (i >= 30 && i < 40) y = 550 - (i - 30) * 50;
      ctx.strokeStyle = 'black';
      ctx.strokeRect(x, y, 50, 35);
      ctx.font = '10px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText(String(i + 1), x + 18, y + 20);
      // Optionally display tile name
      if (board.tiles[i] && board.tiles[i].name) {
        ctx.fillText(board.tiles[i].name.substring(0, 7), x, y + 32);
      }
    }
    // Draw player tokens
    board.players.forEach((player) => {
      // Get player tile position
      const pos = player.position % TILE_COUNT;
      // reuse the same tile math as above
      let x = 50 + (pos % 10) * 65 + 25;
      let y =
        pos < 10
          ? 50 + 17
          : pos < 20
            ? 50 + (pos - 10) * 50 + 17
            : pos < 30
              ? 550 + 17
              : 550 - (pos - 30) * 50 + 17;
      if (pos >= 20 && pos < 30) x = 700 - (pos - 20) * 65 + 25;
      if (pos >= 30 && pos < 40) y = 550 - (pos - 30) * 50 + 17;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.stroke();
      ctx.font = '10px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText(player.name, x - 12, y + 24);
    });
  }, [board]);

  return <canvas width={CANVAS_WIDTH} height={CANVAS_HEIGHT} ref={canvasRef} />;
};
