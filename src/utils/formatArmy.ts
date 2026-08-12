/**
 * Formats a militia/riders pair as "🧍N 🐎M" for inline display — hides
 * whichever tier is zero (falling back to "🧍0" if both are), so riders
 * show up next to militia wherever an army size is displayed instead of
 * being silently folded into a single 🧍 count.
 */
export function formatArmy(militia: number, riders: number): string {
  const parts: string[] = [];
  if (militia > 0 || riders <= 0) parts.push(`🧍${militia}`);
  if (riders > 0) parts.push(`🐎${riders}`);
  return parts.join(' ');
}
