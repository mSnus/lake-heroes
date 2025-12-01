import { shuffle } from './common';

// Place tiles according to rules:
// - Fixed placements (1-based positions):
//   #1 King Castle, #8 Treasure box, #13 Prison, #17 Treasure box, #20 Freelancers' camp
// - Remaining tiles placed from a randomized stack
// - No adjacent tiles of the same group unless there are no alternatives left
// - If not enough tiles to fill, leave remaining slots blank (undefined)
export function buildTileLayoutFromTemplates(allTemplates: any[]): (any | undefined)[] {
  const SLOT_COUNT = 24; // rectangular path 8x6 perimeter

  // Helper: find by name contains
  const byName = (substr: string) =>
    (allTemplates as any[]).find((t) => typeof t?.name === 'string' && t.name.includes(substr));

  const kingCastle = byName('King Castle');
  const prison = byName('Prison');
  const treasureBox = byName('Treasure box');
  const freelancers = byName('Tavern');

  if (!kingCastle) throw new Error('King Castle tile not found');
  if (!treasureBox) throw new Error('Treasure box tile not found');
  if (!prison) throw new Error('Prison tile not found');
  if (!freelancers) throw new Error("Freelancers' camp tile not found");

  // Prepare slots (0-based indices)
  const slots: (any | undefined)[] = new Array(SLOT_COUNT).fill(undefined);

  // Fixed positions (0-based): 0, 7, 12, 16, 19
  const FIXED: [number, any][] = [
    [0, kingCastle],
    [7, treasureBox],
    [12, prison],
    [16, treasureBox],
    [19, freelancers],
  ];
  FIXED.forEach(([idx, tpl]) => {
    slots[idx] = tpl;
  });

  // Build pool = all templates except the exact fixed ones we already used.
  // Important: treasure box is used twice; remove two from the pool if present.
  const pool: any[] = [];
  let treasureToRemove = 2;
  (allTemplates as any[]).forEach((t) => {
    if (t === kingCastle || t === prison || t === freelancers) return; // used once
    if (t === treasureBox && treasureToRemove > 0) {
      treasureToRemove--;
      return; // skip two copies
    }
    pool.push(t);
  });

  // Randomize stack
  const stack = shuffle(pool);

  // Helper to get neighbor groups for constraint
  const getGroup = (tpl: any | undefined) => (tpl ? tpl.group : undefined);

  // Fill remaining slots respecting adjacency constraint when possible
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (slots[i]) continue; // already fixed

    // Determine disallowed group from neighbors already placed or fixed
    const left = i > 0 ? slots[i - 1] : slots[SLOT_COUNT - 1]; // wrap-around neighbor
    const right = i < SLOT_COUNT - 1 ? slots[i + 1] : slots[0]; // may still be undefined if not placed yet
    const leftGroup = getGroup(left);
    const rightGroup = getGroup(right);

    // Try to find a tile not matching left/right groups
    let pickIndex = -1;
    for (let s = 0; s < stack.length; s++) {
      const g = getGroup(stack[s]);
      if (g !== leftGroup && (rightGroup === undefined || g !== rightGroup)) {
        pickIndex = s;
        break;
      }
    }

    // If none found and we still have tiles, relax the constraint
    if (pickIndex === -1 && stack.length > 0) {
      pickIndex = 0;
    }

    if (pickIndex >= 0) {
      const [picked] = stack.splice(pickIndex, 1);
      slots[i] = picked;
    } else {
      // Out of tiles → leave blank
      slots[i] = undefined;
    }
  }

  return slots;
}
