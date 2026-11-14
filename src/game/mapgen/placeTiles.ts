import type { TileJSON } from '../Tile';

const SPECIAL_IDS = ['prison', 'treasure-chest', 'treasure-chest', 'tavern', 'sphynx', 'joker', 'portal', 'ruins', 'stables'];
// Chance the ownable tiles follow the price/group rules below instead of a plain shuffle.
const BASE_RULE_CHANCE = 0.8;

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
};

/** Ownable tiles, cheapest first: the i-th cheapest of every group are shuffled together, then the next tier. */
function orderOwnables(pool: TileJSON[]): TileJSON[] {
  if (Math.random() >= BASE_RULE_CHANCE) return shuffle(pool);
  const byGroup = new Map<string, TileJSON[]>();
  for (const tile of pool) {
    const list = byGroup.get(tile.group ?? '') ?? [];
    list.push(tile);
    byGroup.set(tile.group ?? '', list);
  }

  const groups = Array.from(byGroup.values()).map((g) =>
    [...g].sort((a, b) => (a.prices?.[1] ?? 0) - (b.prices?.[1] ?? 0))
  );
  const depth = Math.max(...groups.map((g) => g.length));
  const ordered: TileJSON[] = [];
  for (let i = 0; i < depth; i++) ordered.push(...shuffle(groups.filter((g) => i < g.length).map((g) => g[i])));
  return ordered;
}

/** Inserts `extra` into `base` at evenly spaced positions, with a random phase. */
function spreadInto<T>(base: T[], extra: T[]): T[] {
  const total = base.length + extra.length;
  const phase = Math.random();
  const out: T[] = [];
  let b = 0;
  let e = 0;
  for (let k = 0; k < total; k++) {
    const due = Math.floor(((k + 1 + phase) * extra.length) / total) > Math.floor(((k + phase) * extra.length) / total);
    if ((due && e < extra.length) || b >= base.length) out.push(extra[e++]);
    else out.push(base[b++]);
  }

  return out;
}

/**
 * Templates for `slotCount` slots in travel order: the King's Castle first,
 * special tiles spread evenly among the ownable ones, and the slots left
 * over spread evenly as plain road.
 */
export function placeTiles(templates: TileJSON[], slotCount: number): TileJSON[] {
  const byId = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) throw new Error(`Tile template ${id} not found`);
    return tpl;
  };

  const specials = shuffle(SPECIAL_IDS.map(byId));
  const ownables = orderOwnables(templates.filter((t) => t.isOwnable));
  const tiles = spreadInto(ownables, specials).slice(0, slotCount - 1);
  const roads = new Array(Math.max(0, slotCount - 1 - tiles.length)).fill(byId('road'));
  return [byId('king-castle'), ...spreadInto(tiles, roads)];
}
