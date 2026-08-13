import { GameState } from '../game/GameState';
import {
  showDragonSkyScreen,
  showDragonAttackScreen,
  showDragonChallengeScreen,
} from '../utils/screenStore';
import { fightDragon, DRAGON_UNITS_THRESHOLD } from './fightDragon';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { checkArtifactProtection } from '../game/artifacts';
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
    handleWeakPlayerAttack(board, updateGameState, onContinue);
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

function dragonSkyWithSay(board: GameState, onContinue: () => void) {
  const player = board.activePlayer;
  say(t('dragonEncounter.soarsOverhead'), 'info');
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

  changeFame(player, -1, 0);

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
    say(t('dragonEncounter.attackedFameLost', { playerName: player.name }), 'error');
  } else {
    const tile = board.tiles[mostExpensiveIdx];
    const tileName = tile.name;
    message = t('dragonEncounter.burnsYourTile', { tileName });

    if (tile.level === 1) {
      tile.owner = null;
      player.ownedTiles = player.ownedTiles.filter((i) => i !== mostExpensiveIdx);
      say(t('dragonEncounter.tileDestroyed', { playerName: player.name, tileName }), 'error');
    } else {
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
