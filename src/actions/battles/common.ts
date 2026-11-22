import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { say, sayInTopic, closeTopic } from '../../utils/say';
import { formatArmy } from '../../utils/formatArmy';
import { t } from '../../i18n';

export type BattleOutcome = 'attacker' | 'defender' | 'tie';

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

/** The militia and riders a battle actually killed on one side. */
export type ArmyLoss = ArmyTally;

export const lossTotal = (loss: ArmyLoss): number => loss.militia + loss.riders;

/** `loss` clamped to what `have` holds; a rounding overshoot on one tier comes off the other. */
function fitLoss(have: ArmyTally, loss: ArmyLoss): ArmyLoss {
  const total = Math.min(have.militia + have.riders, lossTotal(loss));
  const riders = Math.min(have.riders, Math.max(loss.riders, total - have.militia));
  return { militia: total - riders, riders };
}

export function applyArmyLoss(player: Player, loss: ArmyLoss): void {
  const fit = fitLoss(tallyArmy(player), loss);
  player.militia -= fit.militia;
  player.riders -= fit.riders;
}

/** applyArmyLoss for a tile's garrison; a wild (unowned) guard is a plain headcount. */
export function applyGarrisonLoss(tile: Tile, loss: ArmyLoss): void {
  if (!tile.owner) {
    tile.garrison = Math.max(0, tile.garrison - lossTotal(loss));
    return;
  }

  const fit = fitLoss({ militia: tile.garrisonMilitia, riders: tile.garrisonRiders }, loss);
  tile.garrisonMilitia -= fit.militia;
  tile.garrisonRiders -= fit.riders;
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

/** "40🟡 and 🧍3 🐎1"; `army` is an armyLostStr. */
export function lossStr(gold: number, army: string): string {
  const parts = [...(gold > 0 ? [`${gold}🟡`] : []), ...(army ? [army] : [])];
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
    sayInTopic(
      t('topics.wonBattle', { unitsPart, paidPart }),
      t('battleCommon.wonBattleForTile', {
        attackerName: attacker.name,
        tileName: capturedTileName,
        unitsPart,
        paidPart,
      }),
      'success',
      { actor: attacker.name, subject: capturedTileName }
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
  sayInTopic(
    `${outcomeVerb}${capturePart}${unitsPart}${goldPart}`,
    t('battleCommon.logLine', {
      attackerName: attacker.name,
      outcomeVerb,
      defenderLabel,
      capturePart,
      unitsPart,
      goldPart,
    }),
    logLevel,
    { actor: attacker.name }
  );
  if (outcome !== 'attacker') closeTopic();
}
