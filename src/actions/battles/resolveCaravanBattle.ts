import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import {
  BattleResolution,
  RoundResult,
  determineBattleOutcome,
  logBattleSummary,
  perRoundUnitLoss,
} from './common';

/**
 * Resolve a caravan raid (the player attacks). The attacker loses per-round
 * units, then on a win takes the whole prize, on a tie half of it, and nothing
 * on a defeat. Slave caravans pay the prize in freed units instead of gold.
 */
export function resolveCaravanBattle(
  board: GameState,
  attacker: Player,
  opts: { prize: number; slaves: boolean },
  defence: number,
  totalRounds: number,
  results: RoundResult[]
): BattleResolution {
  const outcome = determineBattleOutcome(results);
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;
  const { prize, slaves } = opts;

  const unitLoss = perRoundUnitLoss(defence, totalRounds, results);
  if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);

  let message = '';
  let victoryBg = false;

  if (outcome === 'attacker') {
    if (slaves) {
      attacker.units += prize;
      board.gameMessage = `${attacker.name} freed ${prize}🧍 from the slavers!`;
      message = `${prize}🧍 freed from the slavers join your army!`;
    } else {
      attacker.gold += prize;
      board.gameMessage = `${attacker.name} raided the caravan and pillaged ${prize}🟡!`;
      message = `Pillaged ${prize}🟡`;
    }
    victoryBg = true;
  } else if (outcome === 'tie') {
    const halfPrize = Math.floor(prize / 2);
    if (slaves) {
      attacker.units += halfPrize;
      board.gameMessage = `${attacker.name} freed ${halfPrize}🧍 from the caravan`;
      message = `Freed ${halfPrize}🧍, but others stay in chains`;
    } else {
      attacker.gold += halfPrize;
      board.gameMessage = `${attacker.name} tied with the caravan guards, receiving ${halfPrize}🟡`;
      message = `Caravan defence was too strong, pillaged only ${halfPrize}🟡`;
    }
  } else {
    board.gameMessage = `${attacker.name} failed to raid the caravan`;
    message = `The caravan got away`;
  }

  logBattleSummary(attacker, 'Caravan Guards', outcome, null, unitsBefore, goldBefore);

  return { outcome, message, victoryBg };
}
