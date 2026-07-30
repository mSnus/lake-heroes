import { Player } from '../../game/Player';
import { say } from '../../utils/say';
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

export function lossStr(gold: number, units: number): string {
  const parts = [...(gold > 0 ? [`${gold}🟡`] : []), ...(units > 0 ? [`${units}🧍`] : [])];
  return parts.join(' and ');
}

export function logBattleSummary(
  attacker: Player,
  defenderLabel: string,
  outcome: BattleOutcome,
  capturedTileName: string | null,
  unitsBefore: number,
  goldBefore: number,
  claimed: boolean = false
): void {
  const unitsAfter = attacker.units;
  const goldAfter = attacker.gold;
  const unitDiff = unitsBefore - unitsAfter;
  const goldDiff = goldAfter - goldBefore;

  if (outcome === 'attacker' && claimed && capturedTileName) {
    const unitsPart = unitDiff > 0 ? t('battleCommon.losingUnitsPart', { units: unitDiff }) : '';
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
      ? t('battleCommon.lostUnitsPart', { units: unitDiff, before: unitsBefore, after: unitsAfter })
      : unitDiff < 0
        ? t('battleCommon.gainedUnitsPart', { units: -unitDiff, before: unitsBefore, after: unitsAfter })
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
