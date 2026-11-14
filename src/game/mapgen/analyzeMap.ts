/** A stretch of road between two nodes (the castle, a fork or a merge); `interior` excludes both ends. */
export interface Segment {
  from: number;
  to: number;
  interior: number[];
}

export function inDegrees(links: number[][]): number[] {
  const deg = links.map(() => 0);
  links.forEach((outs) => outs.forEach((t) => deg[t]++));
  return deg;
}

export function isJunction(links: number[][], indeg: number[], slot: number): boolean {
  return links[slot].length > 1 || indeg[slot] > 1;
}

export function segmentsOf(links: number[][]): Segment[] {
  const indeg = inDegrees(links);
  const isNode = (s: number) => s === 0 || isJunction(links, indeg, s);
  const segments: Segment[] = [];
  links.forEach((outs, node) => {
    if (!isNode(node)) return;
    for (const first of outs) {
      const interior: number[] = [];
      let cur = first;
      while (!isNode(cur)) {
        interior.push(cur);
        cur = links[cur][0];
      }

      segments.push({ from: node, to: cur, interior });
    }
  });
  return segments;
}

/** Shortest and longest Castle -> Castle lap, in steps. */
export function lapLengths(links: number[][]): { shortest: number; longest: number } {
  const memo = new Map<number, { shortest: number; longest: number }>();
  const walk = (s: number): { shortest: number; longest: number } => {
    const known = memo.get(s);
    if (known) return known;
    let shortest = Infinity;
    let longest = 0;
    for (const t of links[s]) {
      const rest = t === 0 ? { shortest: 0, longest: 0 } : walk(t);
      shortest = Math.min(shortest, rest.shortest + 1);
      longest = Math.max(longest, rest.longest + 1);
    }

    const result = { shortest, longest };
    memo.set(s, result);
    return result;
  };

  return walk(0);
}

/** The first `n` slots after the castle along its single outgoing road. */
export function stepsAfterCastle(links: number[][], n: number): number[] {
  const out: number[] = [];
  let cur = 0;
  for (let i = 0; i < n && links[cur].length === 1; i++) {
    cur = links[cur][0];
    out.push(cur);
  }

  return out;
}
