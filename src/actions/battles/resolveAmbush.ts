import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { say } from '../../utils/say';
import { ArmyLoss, lossStr, tallyArmy, armyLostStr, applyArmyLoss } from './common';
import { setGameMessage } from '../../utils/gameMessage';
import { t } from '../../i18n';

export type AmbushOutcome = 'win' | 'defeat' | 'tie';

export interface AmbushResolution {
  outcome: AmbushOutcome;
  message: string;
}

const GOLD_PER_KILL = 20;

/**
 * Apply the outcome of an ambush (the game attacks the player).
 * - Win (ambush fails): player loses killed units; earns 20🟡 per ambusher killed.
 * - Tie: player loses 1/4 of involved units and 1/2 gold.
 * - Defeat: player loses killed units; loses 1/4 gold.
 */
export function resolveAmbush(
  board: GameState,
  player: Player,
  attackerUnits: number,
  playerUnitsKilled: ArmyLoss,
  ambusherUnitsKilled: number,
  outcome: AmbushOutcome
): AmbushResolution {
  const goldBefore = player.gold;
  const armyBefore = tallyArmy(player);

  let message = '';

  if (outcome === 'win') {
    // A win routs the ambush. In a brawl the individual kills are visual-only
    // (never tracked), so fall back to the whole ambusher force for the reward
    // rather than crediting 0 gold for a decisive victory.
    const ambushersDefeated = ambusherUnitsKilled > 0 ? ambusherUnitsKilled : attackerUnits;
    const reward = ambushersDefeated * GOLD_PER_KILL;
    const beforeLoss = tallyArmy(player);
    applyArmyLoss(player, playerUnitsKilled);
    const killed = armyLostStr(beforeLoss, player);
    player.gold += reward;

    const rewardStr = reward > 0 ? t('resolveAmbush.receivingGold', { reward }) : '';
    const killLossStr = killed ? t('resolveAmbush.unitsLostSuffix', { army: killed }) : '';
    message =
      reward > 0
        ? t('resolveAmbush.repelledWithReward', { reward, lossStr: killLossStr })
        : t('resolveAmbush.repelled', { lossStr: killLossStr });
  } else if (outcome === 'tie') {
    const unitLoss = Math.floor(attackerUnits / 4);
    const goldLoss = Math.floor(player.gold / 2 / 10) * 10;
    const beforeLoss = tallyArmy(player);
    if (unitLoss > 0) player.units = Math.max(0, player.units - unitLoss);
    player.gold = Math.max(0, player.gold - goldLoss);
    const loss = lossStr(goldLoss, armyLostStr(beforeLoss, player));
    setGameMessage(
      board,
      t('resolveAmbush.barelySurvivesGameMessage', {
        playerName: player.name,
        lossStr: loss ? t('resolveAmbush.lostSuffix', { loss }) : '',
      })
    );
    message = t('resolveAmbush.bloodyStalemate', { lossStr: loss ? t('resolveAmbush.lostSuffix', { loss }) : '' });
  } else {
    const goldLoss = Math.floor(player.gold / 4 / 10) * 10;
    const beforeLoss = tallyArmy(player);
    applyArmyLoss(player, playerUnitsKilled);
    player.gold = Math.max(0, player.gold - goldLoss);
    const loss = lossStr(goldLoss, armyLostStr(beforeLoss, player));
    setGameMessage(
      board,
      t('resolveAmbush.overwhelmedGameMessage', {
        playerName: player.name,
        lossStr: loss ? t('resolveAmbush.lostSuffix', { loss }) : '',
      })
    );
    message = loss ? t('resolveAmbush.lost', { loss }) : t('resolveAmbush.overwhelmed');
  }

  const goldDiff = player.gold - goldBefore;
  const lostArmy = armyLostStr(armyBefore, player);
  const unitsPart = lostArmy ? t('resolveAmbush.lostUnitsPart', { army: lostArmy }) : '';
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
