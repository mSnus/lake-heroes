export const TILE_COUNT = 24;

export const TILE_WIDTH = 120;
export const TILE_HEIGHT = 100;

export const TITLE_BAR_HEIGHT = 28; // px

export const TITLE_FONT = 'bold 12px Arial';
export const BODY_FONT = '9px Arial';
export const EMOJI_FONT = '22px Arial';

export const GAP_PX = 16; // ~1rem

export const ICON_RADIUS = 9; // px (diameter 18)

// Canvas size will be computed at runtime based on device (mobile vs desktop)
export const DIAMOND_SIZE = 14; // marker icon size in px
export const DIAMOND_GAP = 4; // gap between markers
export const DIAMOND_BOTTOM_PADDING = 6; // distance from bottom edge

export function isMobileLayout(): boolean {
  return window.matchMedia("(max-width: 768px)").matches;
}

// Calculate tile position along the rectangular perimeter path
export  function getTilePosition(tileIndex: number): { x: number; y: number } {
  
  const isMobile = isMobileLayout();

  const ratioX = isMobile ? 1.8 : 1;
  const ratioY = isMobile ? 1.2 : 1;

  const tileWidth = TILE_WIDTH / ratioX;
  const tileHeight = TILE_HEIGHT / ratioY;
  const titleBarHeight = TITLE_BAR_HEIGHT / ratioY;  
  
  const boardWidth = isMobile ? 6 : 8; // tiles horizontally
  const boardHeight = isMobile ? 8 : 6; // tiles vertically

    const i = tileIndex % TILE_COUNT;
    // Top row: 0..boardWidth-1 (left to right)
    if (i < boardWidth) {
      return { x: i * tileWidth, y: 0 };
    }
    // Right side: next boardHeight-1 tiles (top to bottom, excluding top-right corner)
    if (i < boardWidth + boardHeight - 1) {
      const rightIndex = i - boardWidth;
      return { x: (boardWidth - 1) * tileWidth, y: (rightIndex + 1) * tileHeight };
    }
    // Bottom row: next boardWidth-1 tiles (right to left, excluding bottom-right corner)
    if (i < boardWidth + boardHeight - 1 + boardWidth - 1) {
      const bottomIndex = i - (boardWidth + boardHeight - 1);
      return {
        x: (boardWidth - 2 - bottomIndex) * tileWidth,
        y: (boardHeight - 1) * tileHeight,
      };
    }
    // Left side: remaining tiles (bottom to top, excluding both corners)
    const leftIndex = i - (boardWidth + boardHeight - 1 + boardWidth - 1);
    return {
      x: 0,
      y: (boardHeight - 2 - leftIndex) * tileHeight,
    };
  }

    // Extract emoji and text parts from tile name
    export function parseTileName(name: string): { emoji: string; textPart1: string; textPart2: string } {
      // Find where text starts (first letter or number after potential emoji)
      let textStart = 0;
      for (let i = 0; i < name.length; i++) {
        const char = name[i];
        const code = char.charCodeAt(0);
        // Check if it's a letter (A-Z, a-z) or number (0-9)
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
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
