export const TILE_COUNT = 24;

export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 80;

export const TITLE_BAR_HEIGHT = 20; // px

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
  return window.matchMedia('(max-width: 768px)').matches;
}

// Load precomputed tile maps (percent coords relative to board width)
import desktopMap from '../../settings/map.json';
import mobileMap from '../../settings/map_mobile.json';

type MapSlotPct = { xPct: number; yPct: number };
const desktopSlots: MapSlotPct[] = desktopMap as any;
const mobileSlots: MapSlotPct[] = mobileMap as any;

// Calculate tile position using precomputed percent coords (both axes are percentages of board width)
export function getTilePosition(tileIndex: number): { x: number; y: number } {
  const isMobile = isMobileLayout();

  const ratioX = isMobile ? 1.8 : 1;
  const ratioY = isMobile ? 1.2 : 1;

  const tileWidth = TILE_WIDTH / ratioX;
  const tileHeight = TILE_HEIGHT / ratioY;

  // board layout in tiles
  const cols = isMobile ? 6 : 8;
  const rows = isMobile ? 8 : 6;

  const boardPixelWidth = cols * tileWidth;
  // note: per requirement, y percentage is expressed relative to board width
  const boardPixelHeight = rows * tileHeight;

  const slots = isMobile ? mobileSlots : desktopSlots;
  const idx = tileIndex % TILE_COUNT;
  const slot = slots[idx];

  // If slot is available and has numeric percentages, compute px coords
  if (slot && typeof slot.xPct === 'number' && typeof slot.yPct === 'number') {
    const x = slot.xPct;
    const y = slot.yPct;
    return { x, y };
  }

  // Fallback: compute as grid top-left progressive
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return { x: col * tileWidth, y: row * tileHeight };
}

// Extract emoji and text parts from tile name
export function parseTileName(name: string): {
  emoji: string;
  textPart1: string;
  textPart2: string;
} {
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
