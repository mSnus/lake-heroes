import artifactsData from '../settings/artifacts.json';
import { GameState } from './GameState';
import { Player } from './Player';

export interface Artifact {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const ARTIFACTS: Artifact[] = artifactsData as Artifact[];

export function getArtifact(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function hasArtifact(player: Player, id: string): boolean {
  return player.artifacts.includes(id);
}

/** Picks a random artifact no player currently owns, or null if none remain. */
export function pickRandomUnownedArtifact(board: GameState): Artifact | null {
  const ownedIds = new Set(board.players.flatMap((p) => p.artifacts));
  const available = ARTIFACTS.filter((a) => !ownedIds.has(a.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Battle dice bonus from owned artifacts, on top of the army-size rollBonus.
 * Broken Blade: +2 vs the Dragon, +1 in every battle (additive with the +2).
 * Daedric Axe: +1 vs the Dragon, +1 in brawl-mode battles.
 */
export function getArtifactRollBonus(
  player: Player,
  opts: { isDragon: boolean; isBrawl: boolean }
): number {
  let bonus = 0;
  if (hasArtifact(player, 'broken-blade')) {
    bonus += 1;
    if (opts.isDragon) bonus += 2;
  }
  if (hasArtifact(player, 'daedric-axe')) {
    if (opts.isDragon) bonus += 1;
    if (opts.isBrawl) bonus += 1;
  }
  return bonus;
}

/** The battle-relevant artifacts a player owns, for display under the names row. */
export function getBattleArtifacts(player: Player): Artifact[] {
  return ARTIFACTS.filter(
    (a) => (a.id === 'broken-blade' || a.id === 'daedric-axe') && hasArtifact(player, a.id)
  );
}

/** Per-artifact breakdown of `getArtifactRollBonus`, for display under the names row. */
export function getArtifactRollBonusBreakdown(
  player: Player,
  opts: { isDragon: boolean; isBrawl: boolean }
): { artifact: Artifact; bonus: number }[] {
  const breakdown: { artifact: Artifact; bonus: number }[] = [];
  if (hasArtifact(player, 'broken-blade')) {
    const bonus = 1 + (opts.isDragon ? 2 : 0);
    const artifact = getArtifact('broken-blade');
    if (artifact) breakdown.push({ artifact, bonus });
  }
  if (hasArtifact(player, 'daedric-axe')) {
    const bonus = (opts.isDragon ? 1 : 0) + (opts.isBrawl ? 1 : 0);
    const artifact = getArtifact('daedric-axe');
    if (artifact && bonus > 0) breakdown.push({ artifact, bonus });
  }
  return breakdown;
}

/** Pristine Diamond: +1000 gold added to the King's-grace reward each lap. */
export function getDiamondGoldBonus(player: Player): number {
  return hasArtifact(player, 'pristine-diamond') ? 1000 : 0;
}

/** Flute of Hammeln: halves fees owed to other players' tiles. */
export function getFeeMultiplier(player: Player): number {
  return hasArtifact(player, 'flute-of-hammeln') ? 0.5 : 1;
}

export type ProtectableEvent = 'dragon-attack' | 'meteor' | 'earthquake';

/**
 * Checks whether an artifact saves the player from a damaging event.
 * Indestructible Umbrella: always saves from dragon-attack/meteor (not earthquake).
 * Divine Beads: 50% chance to save from any of the three.
 */
export function checkArtifactProtection(
  player: Player,
  event: ProtectableEvent
): { saved: boolean; artifact?: Artifact } {
  if (
    (event === 'dragon-attack' || event === 'meteor') &&
    hasArtifact(player, 'indestructible-umbrella')
  ) {
    return { saved: true, artifact: getArtifact('indestructible-umbrella') };
  }
  if (hasArtifact(player, 'divine-beads') && Math.random() < 0.5) {
    return { saved: true, artifact: getArtifact('divine-beads') };
  }
  return { saved: false };
}
