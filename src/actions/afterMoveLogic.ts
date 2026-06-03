import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { becomeBeggar } from './becomeBeggar';
import { showScreen, showPrisonScreen, ScreenButton } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { payFee } from './payFee';
import { fightTile } from './fightTile';

export function afterMoveLogic(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;

  const player = board.activePlayer;
  const tile = board.activeTile;

  console.log(`Action: after move logic for ${player.name} on ${tile.name}`, player, tile);

  if (!tile.isOwnable) {
    setEndTurn();
    gameEvent('hideDice', true);
    return;
  }

  if (tile.isOwned() && tile.owner !== player.name) {
    const owner = board.players.find((p) => p.name === tile.owner);

    // Owner is in prison — no fee collected
    if (owner && (owner.turnsToSkip ?? 0) > 0) {
      setEndTurn();
      return;
    }

    const fee = tile.fee;
    const defence = tile.defence;
    const ownerColor = owner?.color;

    const totalSellGold = player.ownedTiles.reduce((sum, posIdx) => {
      const t = board.tiles[posIdx];
      if (!t || t.owner !== player.name) return sum;
      return sum + t.currentPrice.gold;
    }, 0);
    const canSell = totalSellGold >= fee;
    const canPay = player.gold >= fee;
    const showAcceptLoss = !canPay && !canSell;

    const encounter = {
      playerName: player.name,
      playerColor: player.color,
      tileName: tile.name,
      tileDefence: tile.defence,
      ownerName: tile.owner ?? undefined,
      ownerColor,
      outcomeText: undefined,
      gold: player.gold,
      units: player.units,
    };

    const baseConfig = {
      background: 'assets/screens/guards.jpg',
      fade: true as const,
      spriteImage: tile.spriteImage,
      encounter,
    };

    const baseButtons: ScreenButton[] = [
      {
        label: `Pay fee ${fee}🟡`,
        action: 'pay-fee',
        onClick: () => payFee(board, updateGameState),
        disabled: player.gold < fee,
      },
      {
        label: `Battle ⚔️ (${defence}🧍)`,
        action: 'fight',
        onClick: () => fightTile(board, updateGameState),
        disabled: player.units < defence,
      },
    ];

    const acceptLossButton: ScreenButton = {
      label: `Accept loss 😢 ${totalSellGold}`,
      action: 'fight',
      onClick: () => {
        becomeBeggar(board, updateGameState);
        showPrisonScreen(board.gameMessage);
      },
    };

    const extraButtons: ScreenButton[] = [];
    if (canSell && !canPay) {
      const sellModeConfig = {
        ...baseConfig,
        sellMode: true,
        sellHeader: `Sell tiles to pay the ${fee}🟡 fee or yield to ${tile.owner}`,
        buttons: baseButtons,
      };
      extraButtons.push({
        label: 'Sell tiles 💰',
        action: 'fight',
        onClick: () => showScreen(sellModeConfig),
      });
    }
    if (showAcceptLoss) extraButtons.push(acceptLossButton);
    showScreen({ ...baseConfig, buttons: [...baseButtons, ...extraButtons] });
    return;
  }

  setEndTurn();
}
