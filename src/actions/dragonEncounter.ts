import { GameState } from '../game/GameState';
import { showDragonSkyScreen, showDragonAttackScreen, showDragonChallengeScreen } from '../utils/screenStore';
import { fightDragon, DRAGON_UNITS_THRESHOLD } from './fightDragon';
import { say } from '../utils/say';

const ENCOUNTER_CHANCE = 1 / 12;
const ATTACK_CHANCE = 1 / 6;
const MAX_ENCOUNTERS_PER_CIRCLE = 2;
const FAME_THRESHOLD = 5;
const CIRCLE_THRESHOLD = 3;

export function checkDragonEncounter(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
): boolean {
  const player = board.activePlayer;

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

  // Encounter!
  player.dragonEncounters = (player.dragonEncounters ?? 0) + 1;
  player.dragonEncounteredLastTurn = true;

  if (player.fame < FAME_THRESHOLD || (player.circles ?? 0) <= CIRCLE_THRESHOLD) {
    updateGameState(board);
    dragonSkyWithSay(onContinue);
    return true;
  }

  if (Math.random() >= ATTACK_CHANCE) {
    updateGameState(board);
    dragonSkyWithSay(onContinue);
    return true;
  }

  // Dragon attacks!
  if (player.units < DRAGON_UNITS_THRESHOLD) {
    handleWeakPlayerAttack(board, updateGameState, onContinue);
  } else {
    updateGameState(board);
    showDragonChallengeScreen(
      `The Dragon descends from the skies! Your ${player.units} warriors stand ready. Face it or flee?`,
      () => fightDragon(board, updateGameState),
      onContinue,
      'Flee! 🏃'
    );
  }
  return true;
}

function dragonSkyWithSay(onContinue: () => void) {
  say('A massive black dragon soars overhead...', 'info');
  showDragonSkyScreen(onContinue);
}

function handleWeakPlayerAttack(
  board: GameState,
  updateGameState: (board: GameState) => void,
  onContinue: () => void
) {
  const player = board.activePlayer;

  player.fame = Math.max(0, player.fame - 1);

  let mostExpensiveIdx: number | null = null;
  let maxGold = -1;
  for (const idx of player.ownedTiles) {
    const tile = board.tiles[idx];
    if (!tile || tile.owner !== player.name) continue;
    const gold = tile.currentPrice.gold;
    if (gold > maxGold) {
      maxGold = gold;
      mostExpensiveIdx = idx;
    }
  }

  let message: string;

  if (mostExpensiveIdx === null) {
    message = 'The Dragon swoops down and attacks you!';
    say(`${player.name} is attacked by the dragon! Fame lost.`, 'error');
  } else {
    const tile = board.tiles[mostExpensiveIdx];
    const tileName = tile.name;
    message = `Dragon attacks your ${tileName} and destroys it`;

    if (tile.level === 1) {
      tile.owner = null;
      player.ownedTiles = player.ownedTiles.filter((i) => i !== mostExpensiveIdx);
      say(`${player.name}'s ${tileName} was destroyed by the Dragon!`, 'error');
    } else {
      tile._level = tile.level - 1;
      say(
        `${player.name}'s ${tileName} was damaged by the Dragon (now level ${tile._level})!`,
        'error'
      );
    }
  }

  updateGameState(board);
  showDragonAttackScreen(message, onContinue);
}
