import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { becomeBeggar } from './becomeBeggar';
import { showScreen, showPrisonScreen, clearScreen, ScreenButton } from '../utils/screenStore';
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

    // A jailed owner can't collect a fee, so paying is replaced by a free pass.
    const ownerInPrison = !!(owner && (owner.turnsToSkip ?? 0) > 0);

    const fee = tile.fee;
    const defence = tile.defence;
    const ownerColor = owner?.color;

    const sellable = player.ownedTiles.reduce(
      (acc, posIdx) => {
        const t = board.tiles[posIdx];
        if (!t || t.owner !== player.name) return acc;
        acc.gold += t.currentPrice.gold;
        acc.units += t.currentPrice.units;
        return acc;
      },
      { gold: 0, units: 0 }
    );
    const canPay = player.gold >= fee;
    const canFight = player.units >= defence;
    // Selling tops up existing gold/units, so combine both when deciding whether
    // selling could unlock paying the fee or fighting for the tile.
    const canSellForFee = !canPay && player.gold + sellable.gold >= fee;
    const canSellForFight = !canFight && player.units + sellable.units >= defence;
    const canSell = canSellForFee || canSellForFight;
    const showAcceptLoss = !canPay && !canFight && !canSell;

    const encounter = {
      playerName: player.name,
      playerColor: player.color,
      tileName: tile.name,
      tileDefence: tile.defence,
      ownerName: tile.owner ?? undefined,
      ownerColor,
      canFight,
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

    const feeButton: ScreenButton = ownerInPrison
      ? {
          label: `Send him flowers 🌹 to the prison`,
          onClick: () => {
            clearScreen();
            setEndTurn();
          },
        }
      : {
          label: `Pay fee ${fee}🟡`,
          action: 'pay-fee',
          onClick: () => payFee(board, updateGameState),
          disabled: player.gold < fee,
        };

    const baseButtons: ScreenButton[] = [
      feeButton,
      {
        label: `Battle ⚔️ (${defence}🧍)`,
        action: 'fight',
        onClick: () => fightTile(board, updateGameState),
        disabled: player.units < defence,
      },
    ];

    const acceptLossButton: ScreenButton = {
      label: `Accept loss 😢`,
      action: 'fight',
      onClick: () => {
        // Yielding on the battlefield makes the player a prisoner of war, which
        // the King later ransoms when they're about to leave prison.
        player.isPrisonerOfWar = true;
        becomeBeggar(board, updateGameState);
        showPrisonScreen(board.gameMessage);
      },
    };

    const extraButtons: ScreenButton[] = [];
    if (!ownerInPrison && canSell) {
      const sellModeConfig = {
        ...baseConfig,
        sellMode: true,
        sellHeader: `Sell tiles to pay the ${fee}🟡 fee, raise an army, or yield to ${tile.owner}`,
        buttons: baseButtons,
      };
      extraButtons.push({
        label: 'Sell tiles 💰',
        action: 'fight',
        onClick: () => showScreen(sellModeConfig),
      });
    }

    if (!ownerInPrison && showAcceptLoss) extraButtons.push(acceptLossButton);
    showScreen({ ...baseConfig, buttons: [...baseButtons, ...extraButtons] });
    return;
  }

  setEndTurn();
}
