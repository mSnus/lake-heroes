import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { pickRandomUnownedArtifact } from '../../game/artifacts';
import { say } from '../../utils/say';
import { BattleOutcome, BattleResolution } from './common';
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
  if (playerUnitsKilled > 0) player.units = Math.max(0, player.units - playerUnitsKilled);

  const lossStr = playerUnitsKilled > 0 ? t('ruinsEncounter.lostSuffix', { units: playerUnitsKilled }) : '';

  // BattleOutcome 'defender' means the real player (grid defender role) won.
  let message: string;
  if (outcome === 'attacker') {
    message = t('ruinsEncounter.defeatMessage', { lossStr });
    setGameMessage(board, t('ruinsEncounter.defeatGameMessage', { playerName: player.name, lossStr }));
  } else {
    message =
      outcome === 'defender'
        ? t('ruinsEncounter.victoryMessage', { lossStr })
        : t('ruinsEncounter.tieMessage', { lossStr });
    setGameMessage(
      board,
      outcome === 'defender'
        ? t('ruinsEncounter.victoryGameMessage', { playerName: player.name, lossStr })
        : t('ruinsEncounter.tieGameMessage', { playerName: player.name, lossStr })
    );

    if (Math.random() < ARTIFACT_FIND_CHANCE) {
      const artifact = pickRandomUnownedArtifact(board, player);
      if (artifact) {
        player.artifacts.push(artifact.id);
        if (artifact.id === 'medal-of-honor') player.fame += 5;
        if (artifact.id === 'medal-of-distinction') player.fame += 3;
        message += ' ' + t('ruinsEncounter.foundArtifact', { artifact: artifact.name });
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
