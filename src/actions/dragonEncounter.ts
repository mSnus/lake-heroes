import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { playerScore } from '../game/score';
import { DRAGON_MERCY_SCORE_RATIO } from '../game/constants';
import {
  showDragonSkyScreen,
  showDragonAttackScreen,
  showDragonChallengeScreen,
} from '../utils/screenStore';
import { fightDragon, DRAGON_UNITS_THRESHOLD } from './fightDragon';
import { say } from '../utils/say';
import { razeTile } from '../game/tileOwnership';
import { checkArtifactProtection } from '../game/artifacts';
import { isHeadlessRun } from '../utils/headlessStore';
import { shouldChallengeDragon } from '../ai/decisions';
import { announce } from '../utils/announce';
import { t } from '../i18n';

const ENCOUNTER_CHANCE = 1 / 12;
const MAX_ENCOUNTERS_PER_CIRCLE = 2;
const FAME_THRESHOLD_ENCOUNTER = 4;
const FAME_THRESHOLD_ATTACK = 5;
const CIRCLE_THRESHOLD = 3;

export function checkDragonEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void,
  // Cheat: force a dragon *attack* — skip the odds/eligibility gates and both
  // "soars overhead" outcomes, going straight to the attack branch below.
  force = false
): boolean {
  const player = board.activePlayer;

  const ATTACK_CHANCE = player.fame > FAME_THRESHOLD_ATTACK ? 1 / 2 : 1 / 3;

  if (!force) {
    if ((player.circles ?? 0) <= 2) {
      return false;
    }

    if (player.dragonEncounteredLastTurn) {
      player.dragonEncounteredLastTurn = false;
      return false;
    }

    if ((player.dragonEncounters ?? 0) >= MAX_ENCOUNTERS_PER_CIRCLE) {
      return false;
    }

    if (Math.random() >= ENCOUNTER_CHANCE) {
      return false;
    }
  }

  // Encounter!
  player.dragonEncounters = (player.dragonEncounters ?? 0) + 1;
  player.dragonEncounteredLastTurn = true;

  if (!force) {
    if (player.fame < FAME_THRESHOLD_ENCOUNTER || (player.circles ?? 0) <= CIRCLE_THRESHOLD) {
      updateGameState(board);
      dragonSkyWithSay(board, onContinue);
      return true;
    }

    if (Math.random() >= ATTACK_CHANCE) {
      updateGameState(board);
      dragonSkyWithSay(board, onContinue);
      return true;
    }
  }

  // Dragon attacks!
  if (player.armyPower < DRAGON_UNITS_THRESHOLD) {
    // The dragon spares the table's weakest while the strongest is far
    // enough ahead -- burning the poorest player's last tile only widens a
    // gap the King's Grace is already trying to close.
    if (!force && underDragonMercy(board, player)) {
      updateGameState(board);
      dragonSkyWithSay(board, onContinue);
      return true;
    }

    handleWeakPlayerAttack(board, updateGameState, onContinue);
  } else if (isHeadlessRun()) {
    // Fight-or-flee is a real 2-way decision (showDragonChallengeScreen's
    // 2 buttons aren't auto-resolvable) -- same call BotController makes.
    updateGameState(board);
    if (shouldChallengeDragon(player)) {
      announce(player, 'botController.fightTheDragon');
      fightDragon(board, updateGameState);
    } else onContinue();
  } else {
    updateGameState(board);
    showDragonChallengeScreen(
      t('dragonEncounter.descends', {
        playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
      }),
      () => fightDragon(board, updateGameState),
      onContinue,
      t('dragonEncounter.flee')
    );
  }

  return true;
}

/** True when `player` is the weakest by power score and the strongest is at
 * least DRAGON_MERCY_SCORE_RATIO times their score. */
function underDragonMercy(board: GameState, player: Player): boolean {
  if (board.players.length < 2) return false;

  const scores = board.players.map((p) => playerScore(board, p));
  const weakest = Math.min(...scores);
  const strongest = Math.max(...scores);
  if (weakest <= 0) return false;

  return (
    playerScore(board, player) === weakest &&
    strongest >= weakest * DRAGON_MERCY_SCORE_RATIO
  );
}

function dragonSkyWithSay(board: GameState, onContinue: () => void) {
  const player = board.activePlayer;
  // Flavor-only message -- skip it headless so it doesn't clutter the sim log.
  if (!isHeadlessRun()) say(t('dragonEncounter.soarsOverhead'), 'info');
  showDragonSkyScreen(onContinue, player.name, player.color);
}

function handleWeakPlayerAttack(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
) {
  const player = board.activePlayer;

  const protection = checkArtifactProtection(player, 'dragon-attack');
  if (protection.saved) {
    const savedMessage = t('dragonEncounter.savedByArtifact', {
      playerName: player.name,
      artifactName: protection.artifact!.name,
      emoji: protection.artifact!.emoji,
    });
    say(savedMessage, 'success');
    updateGameState(board);
    showDragonAttackScreen(savedMessage, onContinue);
    return;
  }

  let mostExpensiveIdx: number | null = null;
  let maxGold = -1;
  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile || tile.owner !== player.id) continue;
    const gold = tile.currentPrice.gold;
    if (gold > maxGold) {
      maxGold = gold;
      mostExpensiveIdx = idx;
    }
  }

  let message: string;

  if (mostExpensiveIdx === null) {
    message = t('dragonEncounter.attacksYou');
    say(t('dragonEncounter.attackedNothingToBurn', { playerName: player.name }), 'error');
  } else {
    const tile = board.tiles[mostExpensiveIdx];
    const tileName = tile.name;
    message = t('dragonEncounter.burnsYourTile', { tileName });

    if (tile.level === 1) {
      // Nothing left to downgrade: the tile burns down to wilderness, same
      // as a raze -- its own garrison dies with it.
      razeTile(board, tile);
      say(t('dragonEncounter.tileDestroyed', { playerName: player.name, tileName }), 'error');
    } else {
      // Half the garrison burns with the level. Set while the tile is still
      // owned, so the setter splits the loss across militia and riders.
      tile.garrison = Math.floor(tile.garrison / 2);
      tile._level = tile.level - 1;
      say(
        t('dragonEncounter.tileDamaged', { playerName: player.name, tileName, level: tile._level }),
        'error'
      );
    }
  }

  updateGameState(board);
  showDragonAttackScreen(message, onContinue);
}
