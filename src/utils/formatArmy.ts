/**
 * Formats a militia/riders pair as "🧍N 🐎M" for inline display — hides
 * whichever tier is zero (falling back to "🧍0" if both are), so riders
 * show up next to militia wherever an army size is displayed instead of
 * being silently folded into a single 🧍 count.
 *
 * `emoji` re-skins the pair for NPC forces that field the same two tiers
 * under a different guise — caravan guards and their camels, ambushers and
 * their horses (see caravanEncounter/ambushEncounter).
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
/** Ambushers: bandits on foot and on horseback. */
export const AMBUSH_EMOJI = { militia: '🥷', riders: '🐎' };
