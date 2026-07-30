import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { lossStr } from './common';
import { t } from '../../i18n';

export type AmbushOutcome = 'win' | 'defeat' | 'tie';

export interface AmbushResolution {
  outcome: AmbushOutcome;
  message: string;
}

const GOLD_PER_KILL = 200;

/**
 * Apply the outcome of an ambush (the game attacks the player).
 * - Win (ambush fails): player loses killed units; earns 200🟡 per ambusher killed.
 * - Tie: player loses 1/4 of involved units and 1/2 gold.
 * - Defeat: player loses killed units; loses 1/4 gold.
 */
export function resolveAmbush(
  board: GameState,
  player: Player,
  attackerUnits: number,
  playerUnitsKilled: number,
  ambusherUnitsKilled: number,
  outcome: AmbushOutcome
): AmbushResolution {
  const goldBefore = player.gold;
  const unitsBefore = player.units;

  let message = '';

  if (outcome === 'win') {
    // A win routs the ambush. In a brawl the individual kills are visual-only
    // (never tracked), so fall back to the whole ambusher force for the reward
    // rather than crediting 0 gold for a decisive victory.
    const ambushersDefeated = ambusherUnitsKilled > 0 ? ambusherUnitsKilled : attackerUnits;
    const reward = ambushersDefeated * GOLD_PER_KILL;
    if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);
    player.gold += reward;

    const rewardStr = reward > 0 ? t('resolveAmbush.receivingGold', { reward }) : '';
    const killLossStr = playerUnitsKilled > 0 ? t('resolveAmbush.unitsLostSuffix', { units: playerUnitsKilled }) : '';
    board.gameMessage = t('resolveAmbush.repelsGameMessage', { playerName: player.name, rewardStr, lossStr: killLossStr });
    message =
      reward > 0
        ? t('resolveAmbush.repelledWithReward', { reward, lossStr: killLossStr })
        : t('resolveAmbush.repelled', { lossStr: killLossStr });
  } else if (outcome === 'tie') {
    const unitLoss = Math.floor(attackerUnits / 4);
    const goldLoss = Math.floor(player.gold / 2 / 100) * 100;
    if (unitLoss > 0) player.units = Math.max(0, player.units - unitLoss);
    player.gold = Math.max(0, player.gold - goldLoss);
    const loss = lossStr(goldLoss, unitLoss);
    board.gameMessage = t('resolveAmbush.barelySurvivesGameMessage', {
      playerName: player.name,
      lossStr: loss ? t('resolveAmbush.unitsLostSuffix', { units: loss }) : '',
    });
    message = t('resolveAmbush.bloodyStalemate', { lossStr: loss ? t('resolveAmbush.lostSuffix', { loss }) : '' });
  } else {
    const goldLoss = Math.floor(player.gold / 4 / 100) * 100;
    if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);
    player.gold = Math.max(0, player.gold - goldLoss);
    const loss = lossStr(goldLoss, playerUnitsKilled);
    board.gameMessage = t('resolveAmbush.overwhelmedGameMessage', {
      playerName: player.name,
      lossStr: loss ? t('resolveAmbush.unitsLostSuffix', { units: loss }) : '',
    });
    message = loss ? t('resolveAmbush.lost', { loss }) : t('resolveAmbush.overwhelmed');
  }

  const unitDiff = unitsBefore - player.units;
  const goldDiff = player.gold - goldBefore;
  const unitsPart = unitDiff > 0 ? t('resolveAmbush.lostUnitsPart', { units: unitDiff }) : '';
  const goldPart =
    goldDiff > 0
      ? t('resolveAmbush.gainedGoldPart', { gold: goldDiff })
      : goldDiff < 0
        ? t('resolveAmbush.lostGoldPart', { gold: -goldDiff })
        : '';
  const verb = t(
    outcome === 'win'
      ? 'resolveAmbush.repelsVerb'
      : outcome === 'defeat'
        ? 'resolveAmbush.isAmbushedVerb'
        : 'resolveAmbush.survivesVerb'
  );
  say(
    t('resolveAmbush.logLine', { playerName: player.name, verb, unitsPart, goldPart }),
    outcome === 'win' ? 'success' : outcome === 'defeat' ? 'error' : 'info'
  );

  return { outcome, message };
}
