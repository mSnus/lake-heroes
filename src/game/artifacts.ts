import artifactsData from '../settings/artifacts.json';
import { GameState } from './GameState';
import { Player } from './Player';
import { t } from '../i18n';

export interface Artifact {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

interface RawArtifact {
  id: string;
  emoji: string;
}

// Raw (untranslated) data — name/description live in the locale files,
// looked up fresh by id every time an Artifact is handed to a caller, so it
// always reflects whatever language is currently active.
const RAW_ARTIFACTS: RawArtifact[] = artifactsData as RawArtifact[];

function translate(raw: RawArtifact): Artifact {
  return {
    id: raw.id,
    emoji: raw.emoji,
    name: t(`artifacts.${raw.id}.name`),
    description: t(`artifacts.${raw.id}.description`),
  };
}

/** All artifacts, translated for the current language. Recomputed on every
 * call (cheap — 7 entries) rather than cached, so it can't go stale after a
 * language switch. */
export function getArtifacts(): Artifact[] {
  return RAW_ARTIFACTS.map(translate);
}

export function getArtifact(id: string): Artifact | undefined {
  const raw = RAW_ARTIFACTS.find((a) => a.id === id);
  return raw ? translate(raw) : undefined;
}

export function hasArtifact(player: Player, id: string): boolean {
  return player.artifacts.includes(id);
}

/** Broken Blade and Dwemer Axe both grant a battle roll bonus and are
 * balanced against owning just one — a player who already has either one
 * must never also receive the other (see pickRandomUnownedArtifact). */
const EXCLUSIVE_PAIR = ['broken-blade', 'dwemer-axe'];

/** Picks a random artifact no player currently owns and that `receiver`
 * is actually eligible for, or null if none remain. */
export function pickRandomUnownedArtifact(board: GameState, receiver: Player): Artifact | null {
  const ownedIds = new Set(board.players.flatMap((p) => p.artifacts));
  let available = RAW_ARTIFACTS.filter((a) => !ownedIds.has(a.id));
  const ownsExclusive = EXCLUSIVE_PAIR.some((id) => hasArtifact(receiver, id));
  if (ownsExclusive) available = available.filter((a) => !EXCLUSIVE_PAIR.includes(a.id));
  if (available.length === 0) return null;
  return translate(available[Math.floor(Math.random() * available.length)]);
}

/**
 * Battle dice bonus from owned artifacts.
 * Broken Blade: +2 vs the Dragon, +1 in every non-brawl battle (additive with the +2). No bonus in brawl mode.
 * Dwemer Axe: +2 vs the Dragon, +1 in every battle (additive with the +2).
 */
export function getArtifactRollBonus(
  player: Player,
  opts: { isDragon: boolean; isBrawl: boolean }
): number {
  let bonus = 0;
  if (hasArtifact(player, 'broken-blade') && !opts.isBrawl) {
    bonus += 1;
    if (opts.isDragon) bonus += 2;
  }
  if (hasArtifact(player, 'dwemer-axe')) {
    bonus += 1;
    if (opts.isDragon) bonus += 2;
  }
  return bonus;
}

/** The battle-relevant artifacts a player owns, for display under the names row. */
export function getBattleArtifacts(player: Player): Artifact[] {
  return RAW_ARTIFACTS
    .filter((a) => (a.id === 'broken-blade' || a.id === 'dwemer-axe') && hasArtifact(player, a.id))
    .map(translate);
}

/** Per-artifact breakdown of `getArtifactRollBonus`, for display under the names row. */
export function getArtifactRollBonusBreakdown(
  player: Player,
  opts: { isDragon: boolean; isBrawl: boolean }
): { artifact: Artifact; bonus: number }[] {
  const breakdown: { artifact: Artifact; bonus: number }[] = [];
  if (hasArtifact(player, 'broken-blade') && !opts.isBrawl) {
    const bonus = 1 + (opts.isDragon ? 2 : 0);
    const artifact = getArtifact('broken-blade');
    if (artifact) breakdown.push({ artifact, bonus });
  }
  if (hasArtifact(player, 'dwemer-axe')) {
    const bonus = 1 + (opts.isDragon ? 2 : 0);
    const artifact = getArtifact('dwemer-axe');
    if (artifact) breakdown.push({ artifact, bonus });
  }
  return breakdown;
}

/** Pristine Diamond: +1000 gold added to the King's-grace reward each lap. */
export function getDiamondGoldBonus(player: Player): number {
  return hasArtifact(player, 'pristine-diamond') ? 1000 : 0;
}

/** Pipe of Hamelin: halves fees owed to other players' tiles. */
export function getFeeMultiplier(player: Player): number {
  return hasArtifact(player, 'pipe-of-hamelin') ? 0.5 : 1;
}

export type ProtectableEvent = 'dragon-attack' | 'meteor' | 'earthquake' | 'plague' | 'hurricane';

/**
 * Checks whether an artifact saves the player from a damaging event.
 * Indestructible Umbrella: always saves from dragon-attack/meteor (not earthquake/plague/hurricane).
 * Divine Beads: 50% chance to save from any of the five.
 * Pipe of Hamelin: always saves from plague.
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
  if (event === 'plague' && hasArtifact(player, 'pipe-of-hamelin')) {
    return { saved: true, artifact: getArtifact('pipe-of-hamelin') };
  }
  if (hasArtifact(player, 'divine-beads') && Math.random() < 0.5) {
    return { saved: true, artifact: getArtifact('divine-beads') };
  }
  return { saved: false };
}
