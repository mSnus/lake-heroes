import { shuffle } from './common';
import { TILE_COUNT } from '../../game/constants';

// Chance that the "base rules" below (cheapest-first price tiering, no
// same-group neighbours within a stack) get applied at all. The remaining
// 1 - BASE_RULE_CHANCE of the time, the pool is placed via a single plain
// shuffle instead, ignoring price and group entirely -- so an expensive
// tile showing up early, or two same-group tiles landing next to each
// other, stays rare but never impossible.
const BASE_RULE_CHANCE = 0.8;

// Place tiles according to rules:
// - Fixed placements: see FIXED below (the long fork branch 7-12 holds the risky tiles)
// - Remaining (random) tiles distributed via interleaved group stacks, with
//   probability BASE_RULE_CHANCE (otherwise the pool is just plain-shuffled):
//     1. Group pool tiles by their group, sort each group by level-1 gold price (cheapest first)
//     2. Build stacks: stack[i] = ith tile from each group (stack 0 = all cheapest, etc.)
//     3. Shuffle each stack independently
//     4. Distribute stack 0 → stack 1 → ... into free slots in order
//   Guarantees (when the base rules apply): no same-group neighbours within
//   a stack, cheapest tiles appear earliest
export function buildTileLayoutFromTemplates(allTemplates: any[]): (any | undefined)[] {
  const byId = (id: string) => allTemplates.find((t) => t?.id === id);

  const kingCastle = byId('king-castle');
  const prison = byId('prison');
  const treasure = byId('treasure-chest');
  const tavern = byId('tavern');
  const sphynx = byId('sphynx');
  const joker = byId('joker');
  const portal = byId('portal');
  const ruins = byId('ruins');
  const tower = byId('cannon-tower');
  const stables = byId('stables');
  const bows = byId('bows');

  if (!kingCastle) throw new Error('King Castle tile not found');
  if (!treasure) throw new Error('Treasure tile not found');
  if (!prison) throw new Error('Prison tile not found');
  if (!tavern) throw new Error('Tavern tile not found');
  if (!joker) throw new Error('Joker tile not found');
  if (!sphynx) throw new Error('Sphynx tile not found');
  if (!portal) throw new Error('Portal tile not found');
  if (!ruins) throw new Error('Ruins tile not found');
  if (!stables) throw new Error('Stables tile not found');
  if (!bows) throw new Error('Bows tile not found');
  if (!tower) throw new Error('Cannon Tower tile not found');

  const slots: (any | undefined)[] = new Array(TILE_COUNT).fill(undefined);

  const FIXED: [number, any][] = [
    [0, kingCastle],
    [7, bows],
    [8, stables],
    [9, ruins],
    [10, treasure],
    [11, joker],
    [12, tower],
    [13, sphynx],
    [16, prison],
    [18, portal],
    [21, tavern],
    [25, treasure],
  ];
  FIXED.forEach(([idx, tpl]) => {
    slots[idx] = tpl;
  });

  const fixedSet = new Set([
    kingCastle,
    prison,
    treasure,
    tavern,
    sphynx,
    joker,
    portal,
    ruins,
    stables,
    tower,
    bows,
  ]);
  const pool = allTemplates.filter((t) => !fixedSet.has(t));

  let orderedPool: any[];
  if (Math.random() < BASE_RULE_CHANCE) {
    // Group pool tiles by group name, sort each group cheapest first
    const groupMap = new Map<string, any[]>();
    for (const tile of pool) {
      const g = tile.group ?? 'Unknown';
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push(tile);
    }

    for (const tiles of Array.from(groupMap.values())) {
      tiles.sort((a, b) => (a.prices?.[1] ?? 0) - (b.prices?.[1] ?? 0));
    }

    // Build interleaved stacks: stack[i] has the (i+1)th tile from each group
    const groups = Array.from(groupMap.values());
    const maxDepth = Math.max(...groups.map((g) => g.length));
    orderedPool = [];
    for (let i = 0; i < maxDepth; i++) {
      const stack: any[] = [];
      for (const group of groups) {
        if (i < group.length) stack.push(group[i]);
      }

      orderedPool.push(...shuffle(stack));
    }
  } else {
    // Bypass the base rules entirely -- plain shuffle, no price tiering or
    // group-adjacency avoidance.
    orderedPool = shuffle(pool);
  }

  // Fill free slots in board order from the ordered pool
  let poolIdx = 0;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (slots[i]) continue;
    slots[i] = orderedPool[poolIdx++] ?? undefined;
  }

  return slots;
}
