import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { playerScore } from '../game/score';
import { getArtifact } from '../game/artifacts';

/** 🧍/🐎, each shown only when that tier actually has units -- a wiped-out
 * tier disappears instead of showing a bare "0". */
export function formatUnits(militia: number, riders: number): string {
  const parts: string[] = [];
  if (militia > 0) parts.push(`🧍${militia}`);
  if (riders > 0) parts.push(`🐎${riders}`);
  return parts.length > 0 ? parts.join(' ') : '0';
}

export interface CellStats {
  fame: number;
  gold: number;
  militia: number;
  riders: number;
  tilesOwned: number;
  score: number;
  artifactsEmoji: string;
  isPOW: boolean;
}

/** "2🏆 2692🟡 🧍8 1🧩 ⭐5892" -- a player's stat line, shared by the
 * economy sim's per-row cell and its begin/end-of-circle snapshots (see
 * formatPlayerCell for the live-board variant that computes these fields). */
export function formatCellStats(s: CellStats): string {
  const pow = s.isPOW ? ' ⛓️' : '';
  return `${s.fame}🏆 ${s.gold}🟡 ${formatUnits(s.militia, s.riders)} ${s.tilesOwned}🧩 ⭐${s.score}${s.artifactsEmoji}${pow}`;
}

/** Same line as formatCellStats, computed directly off a live board/player
 * instead of a pre-captured snapshot -- used to record a player's state the
 * moment they cross King's Castle (see passStart.ts). */
export function formatPlayerCell(board: GameState, player: Player): string {
  const tilesOwned = board.tiles.filter((t) => t.owner === player.id).length;
  const artifactsEmoji = player.artifacts.map((id) => getArtifact(id)?.emoji ?? '').join('');
  return formatCellStats({
    fame: player.fame,
    gold: player.gold,
    militia: player.militia,
    riders: player.riders,
    tilesOwned,
    score: playerScore(board, player),
    artifactsEmoji,
    isPOW: player.isPrisonerOfWar,
  });
}
