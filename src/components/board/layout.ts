import { shuffle } from './common';
import { TILE_COUNT } from '../../game/constants';

// Place tiles according to rules:
// - Fixed placements (0-based): King=0, Treasure=5, Sphynx=7, Portal=9, Prison=13, Tavern=16, Joker=19, Treasure=23
// - Remaining (random) tiles distributed via interleaved group stacks:
//     1. Group pool tiles by their group, sort each group by level-1 gold price (cheapest first)
//     2. Build stacks: stack[i] = ith tile from each group (stack 0 = all cheapest, etc.)
//     3. Shuffle each stack independently
//     4. Distribute stack 0 → stack 1 → ... into free slots in order
//   Guarantees: no same-group neighbours within a stack, cheapest tiles appear earliest
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

  if (!kingCastle) throw new Error('King Castle tile not found');
  if (!treasure) throw new Error('Treasure tile not found');
  if (!prison) throw new Error('Prison tile not found');
  if (!tavern) throw new Error('Tavern tile not found');
  if (!joker) throw new Error('Joker tile not found');
  if (!sphynx) throw new Error('Sphynx tile not found');
  if (!portal) throw new Error('Portal tile not found');
  if (!ruins) throw new Error('Ruins tile not found');

  const slots: (any | undefined)[] = new Array(TILE_COUNT).fill(undefined);

  const FIXED: [number, any][] = [
    [0, kingCastle],
    [5, treasure],
    [7, sphynx],
    [10, portal],
    [13, prison],
    [16, tavern],
    [19, joker],
    [23, ruins],
  ];
  FIXED.forEach(([idx, tpl]) => {
    slots[idx] = tpl;
  });

  const fixedSet = new Set([kingCastle, prison, treasure, tavern, sphynx, joker, portal, ruins]);
  const pool = allTemplates.filter((t) => !fixedSet.has(t));

  // Group pool tiles by group name, sort each group cheapest first
  const groupMap = new Map<string, any[]>();
  for (const tile of pool) {
    const g = tile.group ?? 'Unknown';
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(tile);
  }

  for (const tiles of Array.from(groupMap.values())) {
    tiles.sort((a, b) => (a.prices?.['1']?.gold ?? 0) - (b.prices?.['1']?.gold ?? 0));
  }

  // Build interleaved stacks: stack[i] has the (i+1)th tile from each group
  const groups = Array.from(groupMap.values());
  const maxDepth = Math.max(...groups.map((g) => g.length));
  const orderedPool: any[] = [];
  for (let i = 0; i < maxDepth; i++) {
    const stack: any[] = [];
    for (const group of groups) {
      if (i < group.length) stack.push(group[i]);
    }

    orderedPool.push(...shuffle(stack));
  }

  // Fill free slots in board order from the ordered pool
  let poolIdx = 0;
  for (let i = 0; i < TILE_COUNT; i++) {
    if (slots[i]) continue;
    slots[i] = orderedPool[poolIdx++] ?? undefined;
  }

  return slots;
}
