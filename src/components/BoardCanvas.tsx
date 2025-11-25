import React, { useRef, useEffect } from 'react';
import { Board } from '../game/Board';
import groupsData from '../settings/groups.json';
import diamondUrl from '../assets/diamond-mono.svg';
import mapUrl from '../assets/map5.png';
import { useMediaQuery } from 'react-responsive';
import {
  TILE_COUNT,
  TILE_WIDTH,
  TILE_HEIGHT,
  TITLE_BAR_HEIGHT,
  TITLE_FONT,
  BODY_FONT,
  EMOJI_FONT,
  GAP_PX,
  ICON_RADIUS,
  DIAMOND_SIZE,
  DIAMOND_GAP,
  DIAMOND_BOTTOM_PADDING,
  getTilePosition,
  isMobileLayout,
  parseTileName,
} from './board/common';
import { drawPlayers } from './board/players';
interface BoardCanvasProps {
  board: Board;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [iconsReady, setIconsReady] = React.useState(false);

  // Switch layout for mobile: vertical (6x8) on mobile, horizontal (8x6) otherwise
  const isMobile = isMobileLayout();
  const ratioX = isMobile ? 1.8 : 1;
  const ratioY = isMobile ? 1.2 : 1;
  const boardWidth = isMobile ? 6 : 8; // tiles horizontally
  const boardHeight = isMobile ? 8 : 6; // tiles vertically
  const tileWidth = TILE_WIDTH / ratioX;
  const tileHeight = TILE_HEIGHT / ratioY;
  const titleBarHeight = TITLE_BAR_HEIGHT / ratioY;
  const CANVAS_WIDTH = boardWidth * tileWidth;
  const CANVAS_HEIGHT = boardHeight * tileHeight;

  // Load diamond image once
  const diamondImgRef = useRef<HTMLImageElement | null>(null);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = diamondUrl as unknown as string;
    img.onload = () => setIconsReady(true); // trigger a re-render to draw markers
    diamondImgRef.current = img;

    const mapImg = new Image();
    mapImg.src = mapUrl as unknown as string;
    mapImg.onload = () => setMapReady(true);
    mapImgRef.current = mapImg;

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
  const groupsByName: Record<string, { name: string; icon: string; color: string }> =
    React.useMemo(() => {
      const map: Record<string, { name: string; icon: string; color: string }> = {};
      (groupsData as any[]).forEach((g: any) => {
        if (g && g.name) map[g.name] = { name: g.name, icon: g.icon, color: g.color };
      });
      return map;
    }, []);

  // Main draw effect: draw background first (only if mapReady), then draw tiles / players.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas then draw background so BG becomes the first layer.
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (mapImgRef.current && mapReady) {
      try {
        ctx.drawImage(mapImgRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (e) {
        // ignore transient draw errors
      }
    }

    // Draw tiles
    for (let i = 0; i < TILE_COUNT; i++) {
      const { x, y } = getTilePosition(i);
      const tile = board.tiles[i];
      const grp = groupsByName[tile.group];
      const barColor = grp?.color || '#EAEAEA';

      ctx.beginPath();
      ctx.arc(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2, TILE_WIDTH / 4, 0, 2 * Math.PI);
      ctx.fillStyle = tile?.owner
        ? board.players.find((p) => p.name === tile.owner)?.color + '33' || '#ffffff30'
        : '#ffffff30';
      ctx.fill();

      ctx.strokeStyle = barColor;
      ctx.lineWidth = 4;
      ctx.stroke();


      // Title bar by group (skip for Special tiles)
      const hasTitle = !!tile && tile.group !== 'Special';
      if (tile && hasTitle) {
        // Prepare text metrics for centering
        ctx.font = TITLE_FONT;

        const iconDiameter = ICON_RADIUS * 2;
        const totalWidth = iconDiameter;
        const startX = x + (tileWidth - totalWidth) / 2;
        const centerX = x + tileWidth / 2;
        const centerY = y + titleBarHeight / 2;

        // Draw icon circle
        const circleCx = isMobile ? centerX : startX + ICON_RADIUS;

        // Draw emoji inside the circle
        if (grp?.icon) {
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#000000';
          ctx.fillText(grp.icon, circleCx, centerY);
        }
      }

      // Draw tile name in 3 lines: emoji, text part 1, text part 2
      if (tile?.name) {
        const { emoji, textPart1, textPart2 } = parseTileName(tile.name);
        const centerX = x + tileWidth / 2;

        // Compute available content box (below title if present)
        const contentTop = y + (hasTitle ? titleBarHeight : 0) - 10;
        const contentHeight = tileHeight - (hasTitle ? titleBarHeight : 0);

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
          ctx.fillStyle = '#000000';
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
            const startX = x + (tileWidth - totalWidth) / 2;
            const drawY = y + tileHeight - DIAMOND_BOTTOM_PADDING - DIAMOND_SIZE;
            for (let d = 0; d < count; d++) {
              const dx = startX + d * (DIAMOND_SIZE + DIAMOND_GAP);
              ctx.drawImage(diamond, dx, drawY);
            }
          }
        }
      }
    }

    // Draw player tokens
    drawPlayers(board, ctx);
  }, [board, iconsReady, boardWidth, boardHeight, CANVAS_WIDTH, CANVAS_HEIGHT, mapReady]);

  return <canvas width={CANVAS_WIDTH} height={CANVAS_HEIGHT} ref={canvasRef} />;
};
