export const TILE_COUNT = 24;

export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 80;

export const TITLE_BAR_HEIGHT = 20; // px

export const TITLE_FONT = 'bold 12px Arial';
export const BODY_FONT = '9px Arial';
export const BODY_MOBILE_FONT = '14px Arial';

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

type MapSlotPct = {
  textPos: null; xPct: number; yPct: number 
};
const desktopSlots: MapSlotPct[] = desktopMap as any;
const mobileSlots: MapSlotPct[] = mobileMap as any;

// Calculate tile position using precomputed percent coords (both axes are percentages of board width)
export function getTilePosition(tileIndex: number): { x: number; y: number; textPos: string | null } {
  const isMobile = isMobileLayout();

  const slots = isMobile ? mobileSlots : desktopSlots;
  const idx = tileIndex % TILE_COUNT;
  const slot = slots[idx];

  const x = slot.xPct;
  const y = slot.yPct;
  const textPos = slot?.textPos || null;
  return { x, y, textPos };
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

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
