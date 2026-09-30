import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { grantArtifact, pickRandomUnownedArtifact } from '../../game/artifacts';
import { say } from '../../utils/say';
import { BattleOutcome, BattleResolution, tallyArmy, armyLostStr } from './common';
import { setGameMessage } from '../../utils/gameMessage';
import { t } from '../../i18n';

const ARTIFACT_FIND_CHANCE = 0.8;

/**
 * Apply the outcome of the Ruins tile's fixed monster encounter (see
 * ruinsEncounter.ts) -- the grid's "attacker" role is the monster
 * occupants, "defender" the real player (an ambush-shaped battle, roles
 * reversed same as a regular ambush). Units lost in the fight are gone
 * regardless of outcome; a win or a tie additionally rolls
 * ARTIFACT_FIND_CHANCE for an unowned artifact, on top of the battle
 * screen's own result.
 */
export function resolveRuinsBattle(
  board: GameState,
  player: Player,
  playerUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const beforeLoss = tallyArmy(player);
  if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);

  const killed = armyLostStr(beforeLoss, player);
  const lossStr = killed ? t('ruinsEncounter.lostSuffix', { army: killed }) : '';

  // BattleOutcome 'defender' means the real player (grid defender role) won.
  // Every other battle resolver reports its outcome via say() (directly, or
  // through logBattleSummary) as well as the banner -- this one only ever
  // set the banner, so nothing was shown at all in the headless-combats
  // real-game path, which skips BattleScreen's own result UI entirely and
  // relies on exactly that toast (see battleResolution.ts's showBattleScreen).
  let message: string;
  let gameMessage: string;
  if (outcome === 'attacker') {
    message = t('ruinsEncounter.defeatMessage', { lossStr });
    gameMessage = t('ruinsEncounter.defeatGameMessage', { playerName: player.name, lossStr });
    setGameMessage(board, gameMessage);
    say(gameMessage, 'error');
  } else {
    message =
      outcome === 'defender'
        ? t('ruinsEncounter.victoryMessage', { lossStr })
        : t('ruinsEncounter.tieMessage', { lossStr });
    gameMessage =
      outcome === 'defender'
        ? t('ruinsEncounter.victoryGameMessage', { playerName: player.name, lossStr })
        : t('ruinsEncounter.tieGameMessage', { playerName: player.name, lossStr });
    setGameMessage(board, gameMessage);
    say(gameMessage, outcome === 'defender' ? 'success' : 'info');

    if (Math.random() < ARTIFACT_FIND_CHANCE) {
      const artifact = pickRandomUnownedArtifact(board, player);
      if (artifact) {
        grantArtifact(player, artifact);
        // No joining space: the string opens its own paragraph (the result
        // panel renders pre-line), and adding one here used to leave a stray
        // double space mid-sentence.
        message += t('ruinsEncounter.foundArtifact', {
          artifact: artifact.name,
          emoji: artifact.emoji,
        });
        say(
          t('ruinsEncounter.foundArtifactToast', {
            playerName: player.name,
            artifactName: artifact.name,
            emoji: artifact.emoji,
          }),
          'success'
        );
      }
    }
  }

  return {
    outcome,
    message,
    victoryBg: outcome === 'defender',
    lostBg: outcome !== 'defender',
  };
}
