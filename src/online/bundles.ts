/**
 * Bundling: several seats sharing one link, so one device can play them all
 * hot-seat. Modelled as `links[i]` = "seat i shares a link with seat i-1", so a
 * bundle is always a run of neighbouring seats, and the whole state is one
 * boolean per seat.
 */

/** The runs of seats that share a link, in seat order. */
export function groupSeats(links: boolean[]): number[][] {
  const groups: number[][] = [];
  links.forEach((joined, seat) => {
    if (joined && groups.length) groups[groups.length - 1].push(seat);
    else groups.push([seat]);
  });

  return groups;
}

/** Bundle a run with the one before it. No-op for the first run. */
export function mergeWithPrevious(links: boolean[], group: number[]): boolean[] {
  const next = [...links];
  if (group[0] > 0) next[group[0]] = true;
  return next;
}

/** Peel the last seat off a bundle so it gets its own link again. */
export function splitLast(links: boolean[], group: number[]): boolean[] {
  const next = [...links];
  if (group.length > 1) next[group[group.length - 1]] = false;
  return next;
}

/** The link for a bundle: one code, or several separated by commas. */
export function bundleLink(codes: string[]): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?code=${codes.join(',')}`;
}
