import { GridUnit, UnitKind } from './types';

interface LocalCell {
  col: number;
  row: number;
}

interface PlacedCell extends LocalCell {
  kind: UnitKind;
}

export type FormationKind = 'square' | 'triangle' | 'columns' | 'grouped' | 'dragon' | 'compact';

export interface FormationSpec {
  kind: FormationKind;
  /** Only used by 'grouped' (towers/squads) — how many separate clusters
   * to split the army into, each its own sub-formation, laid out with a
   * gap between them. Omitted for other kinds. */
  groupCount?: number;
}

// ── Hand-authored "circle" formations for headcounts 2-10 ──
// Local (col,row) offsets, tip/front-neutral orientation; oriented per side
// by placeFormation below. 1 unit is a trivial single cell (no spec given).
const SHAPES: Record<number, LocalCell[]> = {
  1: [{ col: 0, row: 0 }],
  2: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
  ],
  3: [
    { col: 0, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: 2 },
  ],
  4: [
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 1, row: 2 },
  ],
  5: [
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 1, row: 2 },
  ],
  6: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 0, row: 2 },
    { col: 1, row: 2 },
  ],
  7: [
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 1, row: 2 },
    { col: 2, row: 2 },
  ],
  8: [
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 1, row: 2 },
    { col: 2, row: 2 },
  ],
  // Three ranks of three. Authored as a plain block: the grid's own half-cell
  // row offset (plus placeFormation's attacker compensation) is what steps the
  // middle rank forward on both sides -- xxx / .xxx / xxx as seen on screen.
  9: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 0, row: 2 },
    { col: 1, row: 2 },
    { col: 2, row: 2 },
  ],
  10: [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 0, row: 2 },
    { col: 1, row: 2 },
    { col: 2, row: 2 },
  ],
};

// ── Brawl (compact board) formations for headcounts 1-12 ──
// Deliberately tall and narrow — a tight two-column block (front column =
// local col 0, the enemy-facing edge; back column = col 1), filled top-down
// with the odd unit sticking out the front. Authored front-neutral and
// oriented per side by placeFormation. Kept to two columns so a brawl needs
// few grid columns and renders bigger cells without any horizontal zigzag.
function brawlBlock(n: number): LocalCell[] {
  const front = Math.ceil(n / 2);
  const back = Math.floor(n / 2);
  const cells: LocalCell[] = [];
  for (let r = 0; r < front; r++) cells.push({ col: 0, row: r });
  for (let r = 0; r < back; r++) cells.push({ col: 1, row: r });
  return cells;
}
const BRAWL_SHAPES: Record<number, LocalCell[]> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [i + 1, brawlBlock(i + 1)])
);

/** A coiled-dragon silhouette of exactly 50 cells — hand-derived from a
 * reference pixel-art dragon by downsampling to fit the battlefield, then
 * hand-symmetrized left-right. Currently unused: the dragon fight lines up
 * in a normal grouped formation, since this shape is 7 columns wide and no
 * longer fits the narrower huge board, and its fixed 50 cells no longer
 * match DRAGON_UNITS. Kept for a reworked dragon shape. */
const DRAGON_SHAPE: LocalCell[] = [
  { col: 3, row: 0 },
  { col: 5, row: 0 },
  { col: 2, row: 1 },
  { col: 3, row: 1 },
  { col: 4, row: 1 },
  { col: 5, row: 1 },
  { col: 6, row: 1 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 5, row: 2 },
  { col: 6, row: 2 },
  { col: 2, row: 3 },
  { col: 3, row: 3 },
  { col: 4, row: 3 },
  { col: 5, row: 3 },
  { col: 6, row: 3 },
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
  { col: 5, row: 4 },
  { col: 6, row: 4 },
  { col: 7, row: 4 },
  { col: 2, row: 5 },
  { col: 3, row: 5 },
  { col: 4, row: 5 },
  { col: 5, row: 5 },
  { col: 6, row: 5 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 6 },
  { col: 1, row: 7 },
  { col: 2, row: 7 },
  { col: 3, row: 7 },
  { col: 4, row: 7 },
  { col: 5, row: 7 },
  { col: 6, row: 7 },
  { col: 7, row: 7 },
  { col: 1, row: 8 },
  { col: 2, row: 8 },
  { col: 3, row: 8 },
  { col: 4, row: 8 },
  { col: 5, row: 8 },
  { col: 6, row: 8 },
  { col: 7, row: 8 },
  { col: 4, row: 9 },
  { col: 4, row: 10 },
];

/** Gap (empty rows/cols) left between adjacent sub-formations, whether
 * stacking >10-count chunks or separating tower/squad clusters. */
const GROUP_GAP = 1;

/** Cap on a single sub-formation's headcount — matches the largest shape
 * in SHAPES, since anything past this needs to be split further anyway. */
const MAX_GROUP_SIZE = 10;

/**
 * Split `total` into `count` shares that are as equal as possible, with
 * any remainder favoring the most "central" share rather than spreading
 * across the outer ones — e.g. 22 into 3 -> [7, 8, 7], not [8, 7, 7]. For
 * 2 shares (no true center), the extra goes to the first. This
 * intentionally matches centerIndex() below so the heaviest share always
 * lands on the group that arrangeGroups() places in the middle.
 *
 * The remainder is capped per share at MAX_GROUP_SIZE and spills outward
 * (next-most-central share, then the next, ...) once the center is full —
 * otherwise a large-enough remainder could push a single share's headcount
 * past what SHAPES has an entry for (e.g. 47 into 5 shares is base 9,
 * remainder 2 — dumping all of it on the center alone would reach 11).
 */
function splitEvenlyCenterHeavy(total: number, count: number): number[] {
  if (count <= 1) return total > 0 || count === 1 ? [total] : [];
  const base = Math.floor(total / count);
  let remainder = total - base * count;
  const sizes = new Array(count).fill(base);

  // Fill the center slot with as much of the remainder as it can hold (up
  // to the cap) before spilling any of it to the next-most-central slot —
  // not one unit per slot per pass, which would spread even a small
  // remainder across several slots instead of concentrating it centrally.
  const order = centerOutwardOrder(count);
  for (const idx of order) {
    if (remainder <= 0) break;
    // Clamped at 0: if `base` itself already exceeds the cap (total so far
    // outstrips what count*MAX_GROUP_SIZE can hold — e.g. an all-riders
    // army split across too few forced squads), "room" would otherwise go
    // negative and get picked as the smallest `take`, which *subtracts*
    // from that share and *grows* the remainder instead of shrinking it.
    const room = Math.max(0, MAX_GROUP_SIZE - sizes[idx]);
    const take = Math.min(room, remainder);
    sizes[idx] += take;
    remainder -= take;
  }
  // Every share may already be at/over the cap with remainder still left
  // (same scenario as above) — there's no "room" left to target, but the
  // remainder must still land somewhere so the total stays exact. Spread
  // it one unit at a time, center-outward again.
  for (let i = 0; remainder > 0; i++) {
    sizes[order[i % order.length]] += 1;
    remainder--;
  }
  return sizes;
}

/**
 * Split `total` into `count` shares, packing as many shares as possible to
 * full strength (MAX_GROUP_SIZE) first and putting only the leftover into
 * the remaining shares (via splitEvenlyCenterHeavy, so that remainder is
 * itself center-weighted). Used for forced-groupCount (tower/squad) armies
 * big enough to field full-strength sub-formations — e.g. 45 into 6 shares
 * -> [10, 10, 10, 10, 3, 2], not 6 similarly-sized ~7-8 shares.
 */
function splitFrontLoaded(total: number, count: number): number[] {
  if (count <= 0) return [];
  const fullCount = Math.min(count, Math.floor(total / MAX_GROUP_SIZE));
  const remaining = total - fullCount * MAX_GROUP_SIZE;
  const partialCount = count - fullCount;

  if (partialCount <= 0) {
    // Every requested share is already full-strength (e.g. a tower whose
    // level/groupCount is smaller than its garrison actually needs) and
    // there's still leftover — pile it onto the last share rather than
    // spawning an extra one the caller didn't ask for. That share now
    // exceeds MAX_GROUP_SIZE, but layoutGroup's recursive per-share call
    // (with no forced count of its own) chunks it further automatically.
    const sizes = new Array(count).fill(MAX_GROUP_SIZE);
    sizes[count - 1] += remaining;
    return sizes;
  }

  const partialSizes = splitEvenlyCenterHeavy(remaining, partialCount);
  return new Array(fullCount).fill(MAX_GROUP_SIZE).concat(partialSizes);
}

function centerIndex(count: number): number {
  if (count <= 2) return 0; // no true middle for 1-2 groups — front-load
  return Math.floor(count / 2);
}

/** Slot indices ordered by distance from the center index, closest first —
 * how remainder overflow spills outward once the center slot is full. */
function centerOutwardOrder(count: number): number[] {
  const center = centerIndex(count);
  return Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b
  );
}

/** Stack positions in outside-in pairing order: (0, count-1), (1, count-2),
 * ... down to the lone middle slot for an odd count. Feeding sizes sorted
 * biggest-first into positions in this order puts the biggest squads at
 * the two ends and the smallest ones toward the middle, symmetric
 * top-to-bottom — e.g. 3 squads -> [big, small, big]. */
function outsideInOrder(count: number): number[] {
  const order: number[] = [];
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    order.push(lo, hi);
    lo++;
    hi--;
  }
  if (lo === hi) order.push(lo);
  return order;
}

function boundingBox(cells: LocalCell[]): { width: number; height: number } {
  if (cells.length === 0) return { width: 0, height: 0 };
  let maxCol = 0;
  let maxRow = 0;
  for (const c of cells) {
    if (c.col > maxCol) maxCol = c.col;
    if (c.row > maxRow) maxRow = c.row;
  }
  return { width: maxCol + 1, height: maxRow + 1 };
}

/** Cells of a single shape, front edge first — every shape here is
 * authored with local col 0 as its forward edge (see placeFormation's
 * per-side mirroring), so sorting by ascending col puts the cells closest
 * to the enemy first. Used to seat riders on that front edge (they attack
 * first) and militia behind them. */
function orderByFrontness(cells: LocalCell[]): LocalCell[] {
  return [...cells].sort((a, b) => a.col - b.col || a.row - b.row);
}

/** Stack sub-formations into a single front-flush column (front edge of
 * every shape stays at local col 0), one below the next separated by
 * GROUP_GAP. Returns the stack's own bounding size alongside its cells so
 * callers can center a shorter stack against a taller one. */
function stackColumnLocal(groups: PlacedCell[][]): { cells: PlacedCell[]; height: number; width: number } {
  let rowCursor = 0;
  let maxWidth = 0;
  const cells: PlacedCell[] = [];
  for (const group of groups) {
    const box = boundingBox(group);
    for (const c of group) cells.push({ col: c.col, row: c.row + rowCursor, kind: c.kind });
    rowCursor += box.height + GROUP_GAP;
    maxWidth = Math.max(maxWidth, box.width);
  }
  return { cells, height: Math.max(0, rowCursor - GROUP_GAP), width: maxWidth };
}

/**
 * Arrange several already-built sub-formations into a single front-flush
 * vertical column, ordered symmetrically by size — the biggest squads at
 * the two ends, the smallest tucked toward the middle (see
 * outsideInOrder) — rather than in whatever order they were built.
 */
function arrangeGroups(groups: PlacedCell[][]): PlacedCell[] {
  const g = groups.length;
  if (g === 0) return [];
  if (g === 1) return groups[0];

  const bySizeDesc = [...groups].sort((a, b) => b.length - a.length);
  const positions = outsideInOrder(g);
  const ordered: PlacedCell[][] = new Array(g);
  bySizeDesc.forEach((group, i) => {
    ordered[positions[i]] = group;
  });

  // Front-flush, not centered: every shape is already authored with its
  // front edge at local col 0, so leaving dCol at 0 for every group lines
  // up their fronts along the same column regardless of how wide each
  // group's own back end is — centering would instead misalign the fronts
  // whenever the groups have different widths.
  return stackColumnLocal(ordered).cells;
}

/**
 * Build a "circle" formation for a militia/riders composition, splitting
 * into multiple sub-formations (arranged via arrangeGroups) whenever the
 * total exceeds 10 or a specific groupCount is forced (towers/squads).
 * Militia and riders are split across sub-groups independently (each via
 * splitEvenlyCenterHeavy), so riders end up spread proportionally across
 * every cluster rather than concentrated in one.
 */
function layoutGroup(comp: { militia: number; riders: number }, forcedGroupCount?: number): PlacedCell[] {
  const total = comp.militia + comp.riders;
  if (total <= 0) return [];

  if (!forcedGroupCount && total <= 10) {
    const ordered = orderByFrontness(SHAPES[total]);
    return ordered.map((c, i) => ({ ...c, kind: i < comp.riders ? 'rider' : 'militia' }));
  }

  const groupCount = forcedGroupCount ?? Math.ceil(total / 10);
  if (groupCount <= 1) {
    // A forced single group whose total still exceeds 10 (e.g. one tower
    // with a large garrison) — recurse without forcing a count, so it
    // naturally chunks into ceil(total/10) sub-groups instead.
    return layoutGroup(comp);
  }

  let militiaSizes: number[];
  let riderSizes: number[];
  if (forcedGroupCount) {
    // Forced groupCount (towers/squads): pack shares to full strength
    // front-to-back rather than spreading everyone thin (see
    // splitFrontLoaded). Riders are split as evenly as possible across
    // every share regardless of its size, capped at what each share can
    // actually hold — any overflow from an undersized share spills into
    // whichever other shares still have room, center-outward.
    const sizes = splitFrontLoaded(total, groupCount);
    const riderShares = splitEvenlyCenterHeavy(comp.riders, groupCount);
    let overflow = 0;
    for (let i = 0; i < groupCount; i++) {
      const capped = Math.min(riderShares[i], sizes[i]);
      overflow += riderShares[i] - capped;
      riderShares[i] = capped;
    }
    for (const idx of centerOutwardOrder(groupCount)) {
      if (overflow <= 0) break;
      const room = sizes[idx] - riderShares[idx];
      const take = Math.min(room, overflow);
      riderShares[idx] += take;
      overflow -= take;
    }
    riderSizes = riderShares;
    militiaSizes = sizes.map((s, i) => s - riderShares[i]);
  } else {
    // Each share is capped at MAX_GROUP_SIZE by splitEvenlyCenterHeavy, but
    // a *forced* groupCount (towers/squads) can still divide out to a base
    // share above that cap (e.g. 3 towers, 35 units -> base 11) — the
    // recursive layoutGroup call per share (with no forced count of its
    // own) handles that by chunking that specific share further on its own.
    militiaSizes = splitEvenlyCenterHeavy(comp.militia, groupCount);
    riderSizes = splitEvenlyCenterHeavy(comp.riders, groupCount);
  }
  const subGroups = militiaSizes.map((m, i) => layoutGroup({ militia: m, riders: riderSizes[i] }));
  return arrangeGroups(subGroups);
}

/** Ambushers: a diamond-shaped wedge with its single-cell tip pointed at
 * the enemy — column 0 (tip) has 1 unit, each column out from it grows by
 * 1 unit, up to a peak column that absorbs whatever's left over, then
 * mirrors back down to 1 unit at the rear. Symmetric front-to-back, unlike
 * a wedge that keeps widening and gets abruptly truncated wherever the
 * army runs out. */
function triangleLayout(comp: { militia: number; riders: number }): PlacedCell[] {
  const total = comp.militia + comp.riders;
  if (total <= 0) return [];
  const cells: LocalCell[] = [];

  let k = 0;
  while ((k + 2) * (k + 2) <= total) k++;
  const flankSum = k * (k + 1);
  const peak = total - flankSum;

  const widths: number[] = [];
  for (let i = 1; i <= k; i++) widths.push(i);
  widths.push(peak);
  for (let i = k; i >= 1; i--) widths.push(i);

  widths.forEach((count, col) => {
    const startRow = -Math.floor(count / 2);
    for (let i = 0; i < count; i++) cells.push({ col, row: startRow + i });
  });

  const ordered = orderByFrontness(cells);
  return ordered.map((c, i) => ({ ...c, kind: i < comp.riders ? 'rider' : 'militia' }));
}

/**
 * Brawl formation: a tall, narrow shape from BRAWL_SHAPES (1-12) — see that
 * table. Riders take the front cells (lowest local col) as everywhere else.
 * Falls back to full-height columns for the (out-of-range) 13+ case, which a
 * brawl never actually reaches (both sides are capped at BRAWL_THRESHOLD).
 */
function compactLayout(comp: { militia: number; riders: number }, maxRows: number): PlacedCell[] {
  const total = comp.militia + comp.riders;
  if (total <= 0) return [];
  const shape = BRAWL_SHAPES[total];
  if (!shape) return columnsLayout(comp, maxRows);
  const ordered = orderByFrontness(shape);
  return ordered.map((c, i) => ({ ...c, kind: i < comp.riders ? 'rider' : 'militia' }));
}

/** Caravan guards: as few columns as possible, each filled to the grid's
 * full height before starting the next — "columns of maximum height". */
function columnsLayout(comp: { militia: number; riders: number }, maxRows: number): PlacedCell[] {
  const total = comp.militia + comp.riders;
  const cells: LocalCell[] = [];
  let remaining = total;
  let col = 0;
  while (remaining > 0) {
    const count = Math.min(maxRows, remaining);
    for (let r = 0; r < count; r++) cells.push({ col, row: r });
    remaining -= count;
    col++;
  }
  // Riders fill from local col 0 onward -- the front-most column(s), by
  // the same "col 0 = the edge closest to the enemy" convention every
  // formation here shares (see placeFormation's per-side mirroring).
  return cells.map((c, i) => ({ ...c, kind: i < comp.riders ? 'rider' : 'militia' }));
}

function mirrorHorizontal(cells: PlacedCell[]): PlacedCell[] {
  const { width } = boundingBox(cells);
  return cells.map((c) => ({ ...c, col: width - 1 - c.col }));
}

/**
 * Place a whole side's army into one of the non-square formations
 * (everything but the default square block, which placement.ts's
 * placeArmy still handles) — triangle (ambushers), columns (caravan
 * guards), or grouped (towers/squads: tile guards, player squads).
 * Units must already be in militia-then-riders order and sized to match
 * `militia + riders` exactly (see engine.ts's createBattle).
 */
export function placeFormation(
  units: GridUnit[],
  side: 'attacker' | 'defender',
  cols: number,
  rows: number,
  formation: FormationSpec,
  militia: number,
  riders: number
): void {
  let placed: PlacedCell[];
  switch (formation.kind) {
    case 'triangle':
      placed = triangleLayout({ militia, riders });
      break;
    case 'columns':
      placed = columnsLayout({ militia, riders }, rows);
      break;
    case 'compact':
      placed = compactLayout({ militia, riders }, rows);
      break;
    case 'grouped':
      placed = layoutGroup({ militia, riders }, formation.groupCount);
      break;
    case 'dragon':
      // A single fixed shape rather than a size-driven layout, so it only
      // fits a side of exactly DRAGON_SHAPE.length. No caller asks for this
      // formation today (see DRAGON_SHAPE) -- dragons are marked by
      // SideComp.dragon now and lay out grouped like everyone else.
      placed = DRAGON_SHAPE.map((c) => ({ ...c, kind: 'dragon' as UnitKind }));
      break;
    default:
      return; // 'square' stays placement.ts's job
  }

  // Every shape above is authored with its "front" (the tip of a triangle,
  // the forward edge of a cluster) at the LOW end of its local columns —
  // which already suits the defender (whose forward direction, toward the
  // attacker, is decreasing col). The attacker's forward direction is
  // increasing col, so its shape needs a horizontal flip to point the same
  // logical "front" the opposite way.
  if (side === 'attacker') placed = mirrorHorizontal(placed);

  const box = boundingBox(placed);
  const startRow = Math.floor((rows - box.height) / 2);
  // Anchor each side's front edge 1 cell off the grid's vertical center
  // (so the two fronts start 2 cells apart, with the center column itself
  // empty) and let the shape (already oriented so its front points the
  // right way) extend backward from there, toward that side's own edge.
  // The attacker gets an extra column of margin here: the hex-offset
  // compensation below can nudge its front-most cell 1 column further
  // right *after* this anchor is picked, so without the margin that nudge
  // would eat into the gap instead of staying inside the attacker's own
  // reserved space.
  const centerCol = Math.floor(cols / 2);
  // Compact (brawl) armies stand a little further apart — 3 empty columns
  // between the two fronts instead of 2 (the attacker already sits at
  // centerCol-2, so nudging the defender to centerCol+2 centres a 3-cell gap).
  const defenderOffset = formation.kind === 'compact' ? 2 : 1;
  // A compact defender reserves one extra column the same way the attacker
  // does above, because its own odd-row nudge below shifts it one column
  // right -- without the margin that nudge would clamp at the board edge and
  // squash the block instead of mirroring it.
  const defenderMargin = formation.kind === 'compact' ? 1 : 0;
  const startCol =
    side === 'attacker'
      ? Math.max(0, centerCol - box.width - 1)
      : Math.max(0, Math.min(cols - box.width, centerCol + defenderOffset) - defenderMargin);

  // Zip cells to units per kind (not just militia/rider — the dragon
  // formation's cells are all kind 'dragon'), matching whatever kinds are
  // actually present. Zombies are laid out exactly like militia (the layout
  // functions above only ever emit 'militia'/'rider'/'dragon' cells, never
  // knowing about the zombie reskin), so they're matched to militia-shaped
  // cells too. Dragons occupy the rider slot, so outside their own
  // silhouette (whose cells really are kind 'dragon') they match rider
  // cells -- without this every dragon finds no cell at all and stays
  // stacked on its default position.
  const cellKindOf = (k: UnitKind): UnitKind =>
    k === 'zombie' ? 'militia' : k === 'dragon' && formation.kind !== 'dragon' ? 'rider' : k;
  const kinds = Array.from(new Set<UnitKind>([...placed.map((c) => c.kind), ...units.map((u) => cellKindOf(u.kind))]));
  for (const kind of kinds) {
    const cellsOfKind = placed.filter((c) => c.kind === kind);
    const unitsOfKind = units.filter((u) => cellKindOf(u.kind) === kind);
    unitsOfKind.forEach((unit, i) => {
      const c = cellsOfKind[i];
      if (!c) return;
      const row = startRow + c.row;
      // The hex grid visually shifts even rows +0.5 cell right
      // (BattlefieldGrid's colShift) — for the defender that happens to
      // tighten the gap between a shape's ragged edge and its neighboring
      // rows (looks right), but mirroring for the attacker flips which
      // side that raggedness is on without flipping which rows get the
      // shift, so the same nudge widens the gap instead. Odd rows get no
      // automatic shift, so nudging the attacker's odd-row cells one
      // column over restores the same visual spacing the defender already
      // has for free.
      // Brawl blocks are filled rectangles, so mirrorHorizontal is a no-op on
      // them and both sides ended up zigzagging the same way instead of
      // mirroring -- which also handed one side more forward-facing diagonals
      // (hex diagonals point right on even rows, left on odd), skewing small
      // fights badly. Nudging the *defender's* odd rows flips its phase, so
      // the two blocks are true mirror images. The wider full-battle shapes
      // still need the original attacker-side nudge instead.
      const hexCompensation =
        formation.kind === 'compact'
          ? side === 'defender' && row % 2 !== 0
            ? 1
            : 0
          : side === 'attacker' && row % 2 !== 0
            ? 1
            : 0;
      unit.col = Math.max(0, Math.min(cols - 1, startCol + c.col + hexCompensation));
      unit.row = Math.max(0, Math.min(rows - 1, row));
    });
  }
}
