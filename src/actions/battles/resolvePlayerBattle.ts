import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { changeFame } from '../../utils/fame';
import { say } from '../../utils/say';
import { BattleResolution, BattleOutcome } from './common';

/**
 * Resolve a Hero's Hour battle (player vs player).
 * battlefieldUnits = min(attacker.units, defender.units) — same for both sides.
 * - Win: attacker loses killed units; defender loses all units and flees to King's Castle (tile 0).
 * - Tie: both lose half of battlefield units.
 * - Defeat: attacker loses all units and flees to King's Castle; defender loses killed units.
 */
export function resolvePlayerBattle(
  board: GameState,
  attacker: Player,
  defender: Player,
  battlefieldUnits: number,
  attackerUnitsKilled: number,
  defenderUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const aUnitsBefore = attacker.units;
  const aGoldBefore = attacker.gold;

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    defender.units = 0;
    defender.position = 0;
    changeFame(attacker, 1);
    changeFame(defender, -1);

    const lossStr = attackerUnitsKilled > 0 ? `, losing ${attackerUnitsKilled}🧍` : '';
    board.gameMessage = `${attacker.name} defeats ${defender.name}! ${defender.name} flees to the King's Castle${lossStr}`;
    message = `${defender.name} flees to the King's Castle!${lossStr}`;
    victoryBg = true;
  } else if (outcome === 'tie') {
    const quarterLoss = Math.floor(battlefieldUnits / 4);
    if (quarterLoss > 0) {
      attacker.units = Math.max(0, attacker.units - quarterLoss);
      defender.units = Math.max(0, defender.units - quarterLoss);
    }
    board.gameMessage = `${attacker.name} and ${defender.name} fight to a bloody tie — both lose ${quarterLoss}🧍`;
    message = `A bloody tie — both sides lose ${quarterLoss}🧍`;
  } else {
    attacker.units = 0;
    attacker.position = 0;
    if (defenderUnitsKilled > 0) defender.units = Math.max(0, defender.units - defenderUnitsKilled);
    changeFame(attacker, -1);
    changeFame(defender, 1);

    const defLossStr = defenderUnitsKilled > 0 ? ` ${defender.name} loses ${defenderUnitsKilled}🧍.` : '';
    board.gameMessage = `${attacker.name} is defeated by ${defender.name} and flees to the King's Castle`;
    message = `Defeated! You flee to the King's Castle.${defLossStr}`;
    lostBg = true;
  }

  say(
    `⚔️ Hero's Hour: ${attacker.name} vs ${defender.name} — ${outcome === 'attacker' ? 'attacker wins' : outcome === 'defender' ? 'defender wins' : 'tie'} (${aUnitsBefore}→${attacker.units}🧍, ${aGoldBefore}→${attacker.gold}🟡)`,
    outcome === 'attacker' ? 'success' : outcome === 'defender' ? 'error' : 'info'
  );

  return { outcome, message, victoryBg, lostBg };
}
