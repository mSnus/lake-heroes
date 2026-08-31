/**
 * Formats a militia/riders pair as "🧍N 🐎M" for inline display — hides
 * whichever tier is zero (falling back to "🧍0" if both are), so riders
 * show up next to militia wherever an army size is displayed instead of
 * being silently folded into a single 🧍 count.
 *
 * `emoji` re-skins the pair for NPC forces that field the same two tiers
 * under a different guise — caravan guards and their camels, ambushers and
 * rogue hordes (see caravanEncounter/ambushEncounter/rogueAttackEncounter).
 */
export function formatArmy(
  militia: number,
  riders: number,
  emoji: { militia: string; riders: string } = { militia: '🧍', riders: '🐎' }
): string {
  const parts: string[] = [];
  if (militia > 0 || riders <= 0) parts.push(`${emoji.militia}${militia}`);
  if (riders > 0) parts.push(`${emoji.riders}${riders}`);
  return parts.join(' ');
}

/** Caravan guards ride camels rather than horses — same rider stats, own look. */
export const CARAVAN_EMOJI = { militia: '🥷', riders: '🐫' };
/** Ambushers and rogue hordes — the same brigands either way, whether they
 * waylay a travelling army or raid a tile's garrison. */
export const HORDE_EMOJI = { militia: '👹', riders: '🦬' };

/** Re-keys an announcement emoji pair for BattlefieldGrid's `SideIcon`,
 * which keys on UnitKind ('rider', singular) rather than 'riders' — so the
 * grid and the screen announcing it can't drift apart. */
export function toSideIcon(emoji: { militia: string; riders: string }): {
  militia: string;
  rider: string;
} {
  return { militia: emoji.militia, rider: emoji.riders };
}
