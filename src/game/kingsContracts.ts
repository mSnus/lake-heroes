import { GameState } from './GameState';
import { Player } from './Player';

export interface KingsContract {
  playerId: number;
  tilePosition: number;
  award: number;
}

const ISSUE_CHANCE = 0.2;
const MIN_MULTIPLIER = 2;
const MAX_MULTIPLIER = 5;

/**
 * 20% chance to hand the visiting player a contract to claim a random
 * currently-unowned, uncontracted tile, for a gold award of 2x-5x its
 * level-1 price. Returns null if the roll fails or no tile qualifies.
 */
export function issueKingsContract(board: GameState, player: Player): KingsContract | null {
  if (Math.random() >= ISSUE_CHANCE) return null;

  const contractedPositions = new Set(board.kingsContracts.map((c) => c.tilePosition));
  const candidates = board.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => t?.isOwnable && !t.isOwned() && !contractedPositions.has(i));

  if (candidates.length === 0) return null;

  const { t, i } = candidates[Math.floor(Math.random() * candidates.length)];
  const price = t.prices['1']?.gold ?? 0;
  const multiplier = MIN_MULTIPLIER + Math.random() * (MAX_MULTIPLIER - MIN_MULTIPLIER);
  const award = Math.ceil((price * multiplier) / 500) * 500;

  const contract: KingsContract = { playerId: player.id, tilePosition: i, award };
  board.kingsContracts.push(contract);
  return contract;
}

/**
 * Resolves any contract on the just-claimed tile, regardless of who claimed
 * it. If the claimer holds it, they get the award; otherwise it's silently
 * voided (the original holder gets no notice, per design).
 */
export function resolveKingsContractOnClaim(
  board: GameState,
  tilePosition: number,
  claimedBy: Player
): { fulfilled: boolean; award?: number } {
  const idx = board.kingsContracts.findIndex((c) => c.tilePosition === tilePosition);
  if (idx === -1) return { fulfilled: false };

  const [contract] = board.kingsContracts.splice(idx, 1);
  if (contract.playerId === claimedBy.id) {
    return { fulfilled: true, award: contract.award };
  }

  return { fulfilled: false };
}
