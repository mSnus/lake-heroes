import type { TileJSON } from '../Tile';
import { Segment, segmentsOf, stepsAfterCastle } from './analyzeMap';
import { CASTLE_CLEAR_STEPS } from './generateMap';

export const TRAP_IDS = ['joker', 'prison', 'sphynx', 'portal', 'ruins'];
export const BONUS_IDS = ['treasure-chest', 'treasure-chest', 'tavern', 'stables'];
// Added when there are more trap stretches than bonus tiles to pair them with.
const EXTRA_BONUS_ID = 'treasure-chest';
// Chance the ownable tiles follow the price/group rules below instead of a plain shuffle.
const BASE_RULE_CHANCE = 0.8;
const PAIRING_ATTEMPTS = 40;

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

/** `count` items picked evenly spread through `items`, random phase. */
function pickSpread<T>(items: T[], count: number): T[] {
  const step = items.length / count;
  const phase = Math.random() * step;
  return Array.from({ length: count }, (_, k) => items[Math.floor(phase + k * step) % items.length]);
}

/**
 * Which stretch slots get a trap and which a bonus: every stretch holding a
 * trap also holds a bonus and vice versa, spread around the lap. A trap
 * never sits in the castle's first steps or next to another trap. Null when
 * the map has no room for that.
 */
function pairTrapsAndBonuses(links: number[][]): { traps: number[]; bonuses: number[] } | null {
  const noTrap = new Set([0, ...stepsAfterCastle(links, CASTLE_CLEAR_STEPS)]);
  const segments = segmentsOf(links)
    .filter((s) => s.interior.length >= 2 && s.interior.some((slot) => !noTrap.has(slot)))
    .sort((a, b) => a.interior[0] - b.interior[0]);

  const neighbours = (slot: number) => [...links[slot], ...links.flatMap((outs, s) => (outs.includes(slot) ? [s] : []))];

  for (let attempt = 0; attempt < PAIRING_ATTEMPTS; attempt++) {
    let chosen: Segment[];
    let doubled: Segment | null = null;
    if (segments.length >= TRAP_IDS.length) {
      chosen = pickSpread(segments, TRAP_IDS.length);
    } else {
      const roomy = segments.filter((s) => s.interior.length >= 3);
      if (segments.length < TRAP_IDS.length - 1 || !roomy.length) return null;
      chosen = pickSpread(segments, TRAP_IDS.length - 1);
      doubled = roomy.find((s) => chosen.includes(s)) ?? null;
      if (!doubled) continue;
    }

    const traps: number[] = [];
    const bonuses: number[] = [];
    let ok = true;
    for (const seg of chosen) {
      const trapCount = seg === doubled ? 2 : 1;
      const cells = shuffle(seg.interior);
      const trapCells = cells
        .filter((slot) => !noTrap.has(slot) && !traps.some((t) => neighbours(slot).includes(t)))
        .filter((slot, i, arr) => !arr.slice(0, i).some((t) => neighbours(slot).includes(t)))
        .slice(0, trapCount);
      const bonusCell = cells.find((slot) => !trapCells.includes(slot));
      if (trapCells.length < trapCount || bonusCell === undefined) {
        ok = false;
        break;
      }

      traps.push(...trapCells);
      bonuses.push(bonusCell);
    }

    if (ok) return { traps, bonuses };
  }

  return null;
}

/**
 * Templates per slot (index = slot): the King's Castle on slot 0, traps and
 * bonuses paired on the stretches between junctions, ownable tiles in
 * travel order and the rest plain road. Null when this map can't take the
 * pairing -- the caller generates another map.
 */
export function placeTiles(templates: TileJSON[], links: number[][]): TileJSON[] | null {
  const byId = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) throw new Error(`Tile template ${id} not found`);
    return tpl;
  };

  const pairing = pairTrapsAndBonuses(links);
  if (!pairing) return null;

  const placed: (TileJSON | undefined)[] = new Array(links.length).fill(undefined);
  placed[0] = byId('king-castle');
  shuffle(TRAP_IDS).forEach((id, k) => (placed[pairing.traps[k]] = byId(id)));
  const bonusIds = shuffle(BONUS_IDS);
  pairing.bonuses.forEach((slot, k) => (placed[slot] = byId(bonusIds[k] ?? EXTRA_BONUS_ID)));

  const free = placed.map((t, slot) => (t ? -1 : slot)).filter((slot) => slot >= 0);
  const ownables = orderOwnables(templates.filter((t) => t.isOwnable)).slice(0, free.length);
  const roads = new Array(free.length - ownables.length).fill(byId('road'));
  spreadInto(ownables, roads).forEach((tpl, k) => (placed[free[k]] = tpl));
  return placed as TileJSON[];
}
