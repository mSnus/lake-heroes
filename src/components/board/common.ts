export const MONEY_START = 500;
export const UNITS_START = 12;
export const MONEY_PASS_START = 200;
export const FEE_MULTIPLIER = 50;
export const TREASURE_BOX_MULTIPLIER = 100;

export const TILE_COUNT = 25;

export const SPRITE_SIZE = 92;
export const SPRITE_SHIFT = 0;

export const DIAMOND_SIZE = 14; // marker icon size in px
export const DIAMOND_GAP = 4; // gap between markers


export function isMobileLayout(): boolean {
  return window.matchMedia('(max-width: 768px)').matches;
}

// Load precomputed tile maps (percent coords relative to board width)
import mapSetup from '../../settings/map.json';

type MapSlotPct = {
  textPos: null;
  xPct: number;
  yPct: number;
};

const slots: MapSlotPct[] = mapSetup as any;

// Calculate tile position using precomputed percent coords (both axes are percentages of board width)
export function getTilePosition(tileIndex: number): {
  x: number;
  y: number;
  textPos: string | null;
} {
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
