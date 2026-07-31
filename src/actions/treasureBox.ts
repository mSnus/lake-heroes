import { GameState } from '../game/GameState';
import { say } from '../utils/say';
import { TREASURE_BOX_MULTIPLIER } from '../game/constants';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { pickRandomUnownedArtifact } from '../game/artifacts';
import { recordStatEvent } from '../game/statistics';
import { t } from '../i18n';

type TreasureSize = 'small' | 'medium' | 'large';

const TREASURE_SIZE_MULTIPLIERS: Record<TreasureSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

const ARTIFACT_CHANCE = 0.25; // 25% chance to find an artifact

// 0-60 small, 60-85 medium, 85-100 large
function rollTreasureSize(): TreasureSize {
  const roll = Math.random() * 100;
  if (roll < 60) return 'small';
  if (roll < 85) return 'medium';
  return 'large';
}

export function handleTreasureBox(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  roll: number
) {
  if (!board) return;
  console.log('Action: treasure box');

  const player = board.activePlayer;
  const size = rollTreasureSize();
  const sizeLabel = t(`treasureBox.size.${size}`);

  recordStatEvent(board, player, 'treasure');

  const foundArtifact =
    Math.random() < ARTIFACT_CHANCE ? pickRandomUnownedArtifact(board) : null;

  if (foundArtifact) {
    player.artifacts.push(foundArtifact.id);
    if (foundArtifact.id === 'medal-of-honor') player.fame += 5;

    updateGameState(board);
    say(t('treasureBox.foundArtifact', { playerName: player.name, size: sizeLabel, artifactName: foundArtifact.name }), 'success');

    showScreen({
      screenType: 'treasure-result',
      background: 'assets/screens/treasure.jpg',
      title: t('treasureBox.treasureFound'),
      htmlMessage: t('treasureBox.foundArtifactHtml', {
        playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
        size: sizeLabel,
        artifactName: foundArtifact.name,
        emoji: foundArtifact.emoji,
      }),
      fade: true,
      buttons: [
        {
          label: t('treasureBox.letTreasuresGrow'),
          action: 'end-turn',
          onClick: () => {
            clearScreen();
            setEndTurn();
          },
        },
      ],
    });
    return;
  }

  const MULTIPLIER_CIRCLES_START = 1;
  const MULTIPLIER_CIRCLES_6 = 2;
  const MULTIPLIER_CIRCLES_12 = 2.5;

  const circles = player.circles ?? 0;
  const circleMultiplier =
    circles >= 12
      ? MULTIPLIER_CIRCLES_12
      : circles >= 6
        ? MULTIPLIER_CIRCLES_6
        : MULTIPLIER_CIRCLES_START;

  const sizeMultiplier = TREASURE_SIZE_MULTIPLIERS[size];
  const goldReward = Math.round(roll * TREASURE_BOX_MULTIPLIER * circleMultiplier * sizeMultiplier);

  player.gold += goldReward;

  updateGameState(board);
  say(
    t('treasureBox.foundGold', { playerName: player.name, size: sizeLabel, roll, gold: goldReward }),
    'success'
  );

  showScreen({
    screenType: 'treasure-result',
    background: 'assets/screens/treasure.jpg',
    title: t('treasureBox.treasureFound'),
    htmlMessage: t('treasureBox.foundGoldHtml', {
      playerSpan: `<span style="color:${player.color}">${player.name}</span>`,
      size: sizeLabel,
      gold: goldReward,
    }),
    fade: true,
    buttons: [
      {
        label: t('treasureBox.letTreasuresGrow'),
        action: 'end-turn',
        onClick: () => {
          clearScreen();
          setEndTurn();
        },
      },
    ],
  });
}
