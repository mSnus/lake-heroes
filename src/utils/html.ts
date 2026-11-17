const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-z]{3,20})$/;

/** A player's name as HTML in their colour -- both sanitized, since online they come from other players. */
export function playerSpanHtml(name: string, color?: string): string {
  const safeColor = color && SAFE_COLOR.test(color) ? color : 'inherit';
  return `<span style="color:${safeColor}">${escapeHtml(name)}</span>`;
}
