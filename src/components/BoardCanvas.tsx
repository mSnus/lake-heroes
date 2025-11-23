import React, { useRef, useEffect } from 'react';
import { Board } from '../game/Board';
import groupsData from '../settings/groups.json';
import diamondUrl from '../assets/diamond-mono.svg';

interface BoardCanvasProps {
  board: Board;
}

const TILE_COUNT = 24;
const BOARD_WIDTH = 8; // horizontal tiles
const BOARD_HEIGHT = 6; // vertical tiles
const TILE_WIDTH = 120;
const TILE_HEIGHT = 100;
const TITLE_BAR_HEIGHT = 28; // px
const TITLE_FONT = 'bold 12px Arial';
const BODY_FONT = '9px Arial';
const EMOJI_FONT = '22px Arial';
const GAP_PX = 16; // ~1rem
const ICON_RADIUS = 9; // px (diameter 18)
const CANVAS_WIDTH = BOARD_WIDTH * TILE_WIDTH;
const CANVAS_HEIGHT = BOARD_HEIGHT * TILE_HEIGHT;
const DIAMOND_SIZE = 14; // marker icon size in px
const DIAMOND_GAP = 4; // gap between markers
const DIAMOND_BOTTOM_PADDING = 6; // distance from bottom edge

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [iconsReady, setIconsReady] = React.useState(false);

  // Load diamond image once
  const diamondImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = diamondUrl as unknown as string;
    img.onload = () => setIconsReady((v) => !v); // trigger a re-render to draw markers
    diamondImgRef.current = img;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cache for tinted diamonds by color
  const tintedCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  function getTintedDiamond(color: string): HTMLCanvasElement | null {
    const img = diamondImgRef.current;
    if (!img) return null;
    const key = `${color}|${DIAMOND_SIZE}`;
    const cached = tintedCacheRef.current.get(key);
    if (cached) return cached;

    // Draw the svg to an offscreen canvas and tint it with the given color
    const off = document.createElement('canvas');
    off.width = DIAMOND_SIZE;
    off.height = DIAMOND_SIZE;
    const octx = off.getContext('2d');
    if (!octx) return null;
    // Draw SVG scaled to fit
    octx.drawImage(img, 0, 0, DIAMOND_SIZE, DIAMOND_SIZE);
    // Tint using source-in so the alpha from the image acts as mask
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = color;
    octx.fillRect(0, 0, DIAMOND_SIZE, DIAMOND_SIZE);
    octx.globalCompositeOperation = 'source-over';

    tintedCacheRef.current.set(key, off);
    return off;
  }

  // Build lookup for groups by name
  const groupsByName: Record<string, { name: string; icon: string; color: string }> = React.useMemo(() => {
    const map: Record<string, { name: string; icon: string; color: string }> = {};
    (groupsData as any[]).forEach((g: any) => {
      if (g && g.name) map[g.name] = { name: g.name, icon: g.icon, color: g.color };
    });
    return map;
  }, []);

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

      // Title bar by group (skip for Special tiles)
      const hasTitle = !!tile && tile.group !== 'Special';
      if (tile && hasTitle) {
        const grp = groupsByName[tile.group];
        const barColor = grp?.color || '#EAEAEA';

        // Bar background
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, TILE_WIDTH, TITLE_BAR_HEIGHT);

        // Prepare text metrics for centering
        ctx.font = TITLE_FONT;
        const titleText = grp?.name || tile.group || '';
        const textMetrics = ctx.measureText(titleText);
        const textWidth = textMetrics.width;
        const iconDiameter = ICON_RADIUS * 2;
        const totalWidth = iconDiameter + GAP_PX + textWidth;
        const startX = x + (TILE_WIDTH - totalWidth) / 2;
        const centerY = y + TITLE_BAR_HEIGHT / 2;

        // Draw icon circle
        const circleCx = startX + ICON_RADIUS;
        ctx.beginPath();
        ctx.arc(circleCx, centerY, ICON_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw emoji inside the circle
        if (grp?.icon) {
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#000000';
          ctx.fillText(grp.icon, circleCx, centerY);
        }

        // Draw title text
        ctx.font = TITLE_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        const textX = startX + iconDiameter + GAP_PX;
        ctx.fillText(titleText, textX, centerY);
      }

      // Draw tile number
      ctx.font = '10px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillText(String(i + 1), x + 2, y + 12);

      // Draw tile name in 3 lines: emoji, text part 1, text part 2
      if (tile?.name) {
        const { emoji, textPart1, textPart2 } = parseTileName(tile.name);
        const centerX = x + TILE_WIDTH / 2;

        // Compute available content box (below title if present)
        const contentTop = y + (hasTitle ? TITLE_BAR_HEIGHT : 0);
        const contentHeight = TILE_HEIGHT - (hasTitle ? TITLE_BAR_HEIGHT : 0);

        // Build render lines with fonts and line heights
        type Line = { text: string; font: string; height: number };
        const lines: Line[] = [];
        if (emoji) lines.push({ text: emoji, font: EMOJI_FONT, height: 20 });
        if (textPart1) lines.push({ text: textPart1, font: BODY_FONT, height: 12 });
        if (textPart2) lines.push({ text: textPart2, font: BODY_FONT, height: 12 });

        // Total block height
        const totalHeight = lines.reduce((sum, l) => sum + l.height, 0);

        // Start drawing from vertical center of available space
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let offset = -totalHeight / 2;
        const midY = contentTop + contentHeight / 2;

        lines.forEach((l) => {
          ctx.font = l.font;
          // position line center
          const lineCenterY = midY + offset + l.height / 2;
          ctx.fillText(l.text, centerX, lineCenterY);
          offset += l.height;
        });

        // Reset text alignment
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      // Draw tile level markers (diamonds) for owned tiles at the bottom
      if (tile && tile.owner) {
        const owner = board.players.find((p) => p.name === tile.owner);
        const color = owner?.color || '#444';
        const diamond = getTintedDiamond(color);
        if (diamond) {
          const count = Math.max(0, Math.min(3, tile.level));
          if (count > 0) {
            const totalWidth = count * DIAMOND_SIZE + (count - 1) * DIAMOND_GAP;
            const startX = x + (TILE_WIDTH - totalWidth) / 2;
            const drawY = y + TILE_HEIGHT - DIAMOND_BOTTOM_PADDING - DIAMOND_SIZE;
            for (let d = 0; d < count; d++) {
              const dx = startX + d * (DIAMOND_SIZE + DIAMOND_GAP);
              ctx.drawImage(diamond, dx, drawY);
            }
          }
        }
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
  }, [board, iconsReady]);

  return <canvas width={CANVAS_WIDTH} height={CANVAS_HEIGHT} ref={canvasRef} />;
};
