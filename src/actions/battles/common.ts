import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { formatArmy } from '../../utils/formatArmy';
import { BRAWL_THRESHOLD } from '../../game/constants';
import { t } from '../../i18n';

export type BattleOutcome = 'attacker' | 'defender' | 'tie';

/**
 * A brawl (manual, one duel at a time, rightmost attacker vs leftmost
 * defender each round) requires BOTH a small defence and a small attacking
 * force — a big army attacking a weakly-defended tile or caravan fights a
 * normal automatic battle (random pairs) instead.
 */
export function isBrawlMatchup(defence: number, attackerUnits: number): boolean {
  return defence <= BRAWL_THRESHOLD && attackerUnits <= BRAWL_THRESHOLD;
}

export interface RoundResult {
  attackerRoll: number;
  defenderRoll: number;
  /** Attacker units killed this round (by defender's roll). */
  attackerKilled: number;
  /** Defender units killed this round (by attacker's roll). */
  defenderKilled: number;
}

export interface BattleResolution {
  outcome: BattleOutcome;
  message: string;
  victoryBg?: boolean;
  lostBg?: boolean;
}

/** A player's army by tier, for measuring what a battle actually cost them. */
export interface ArmyTally {
  militia: number;
  riders: number;
}

export function tallyArmy(player: Player): ArmyTally {
  return { militia: player.militia, riders: player.riders };
}

/**
 * What `player` has lost since `before`, formatted by tier ("🧍4 🐎2").
 * Losses drain militia first and riders only once militia runs out (see
 * Player's `units` setter), so a headcount alone would report a squad of
 * dead riders as footmen. Empty string when nothing was lost.
 */
export function armyLostStr(before: ArmyTally, player: Player): string {
  const militia = Math.max(0, before.militia - player.militia);
  const riders = Math.max(0, before.riders - player.riders);
  return militia + riders > 0 ? formatArmy(militia, riders) : '';
}

/** armyLostStr for a tile's garrison, which loses tiers in the same order. */
export function garrisonLostStr(
  before: ArmyTally,
  tile: { garrisonMilitia: number; garrisonRiders: number }
): string {
  const militia = Math.max(0, before.militia - tile.garrisonMilitia);
  const riders = Math.max(0, before.riders - tile.garrisonRiders);
  return militia + riders > 0 ? formatArmy(militia, riders) : '';
}

/** The mirror of armyLostStr, for units gained. */
export function armyGainedStr(before: ArmyTally, player: Player): string {
  const militia = Math.max(0, player.militia - before.militia);
  const riders = Math.max(0, player.riders - before.riders);
  return militia + riders > 0 ? formatArmy(militia, riders) : '';
}

export function lossStr(gold: number, units: number): string {
  const parts = [...(gold > 0 ? [`${gold}🟡`] : []), ...(units > 0 ? [`${units}🧍`] : [])];
  return parts.join(' and ');
}

export function logBattleSummary(
  attacker: Player,
  defenderLabel: string,
  outcome: BattleOutcome,
  capturedTileName: string | null,
  armyBefore: ArmyTally,
  goldBefore: number,
  claimed: boolean = false
): void {
  const unitsBefore = armyBefore.militia + armyBefore.riders;
  const unitsAfter = attacker.units;
  const goldAfter = attacker.gold;
  const unitDiff = unitsBefore - unitsAfter;
  const goldDiff = goldAfter - goldBefore;
  // Reported by tier: militia die before riders do, so a headcount alone
  // would call a lost squad of riders footmen.
  const lostArmy = armyLostStr(armyBefore, attacker);
  const gainedArmy = armyGainedStr(armyBefore, attacker);

  if (outcome === 'attacker' && claimed && capturedTileName) {
    const unitsPart = lostArmy ? t('battleCommon.losingUnitsPart', { army: lostArmy }) : '';
    const paidPart = goldDiff < 0 ? t('battleCommon.paidToOwnPart', { gold: -goldDiff }) : '';
    say(
      t('battleCommon.wonBattleForTile', {
        attackerName: attacker.name,
        tileName: capturedTileName,
        unitsPart,
        paidPart,
      }),
      'success'
    );
    return;
  }

  const outcomeVerb = t(
    outcome === 'attacker'
      ? 'battleCommon.winsVerb'
      : outcome === 'defender'
        ? 'battleCommon.losesVerb'
        : 'battleCommon.tiesVerb'
  );
  const capturePart =
    outcome === 'attacker' && capturedTileName ? t('battleCommon.razedPart', { tileName: capturedTileName }) : '';
  const unitsPart =
    unitDiff > 0
      ? t('battleCommon.lostUnitsPart', { army: lostArmy, before: unitsBefore, after: unitsAfter })
      : unitDiff < 0
        ? t('battleCommon.gainedUnitsPart', { army: gainedArmy, before: unitsBefore, after: unitsAfter })
        : '';
  const goldPart =
    goldDiff > 0
      ? t('battleCommon.gainedGoldPart', { gold: goldDiff })
      : goldDiff < 0
        ? t('battleCommon.lostGoldPart', { gold: -goldDiff, before: goldBefore, after: goldAfter })
        : '';
  const logLevel = outcome === 'attacker' ? 'success' : outcome === 'defender' ? 'error' : 'info';
  say(
    t('battleCommon.logLine', {
      attackerName: attacker.name,
      outcomeVerb,
      defenderLabel,
      capturePart,
      unitsPart,
      goldPart,
    }),
    logLevel
  );
}
