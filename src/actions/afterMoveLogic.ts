import React from 'react';
import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { becomeBeggar } from './becomeBeggar';
import { showScreen, showPrisonScreen, ScreenButton } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { say } from '../utils/say';
import { payFee } from './payFee';
import { fightTile } from './fightTile';
import { HeroHourScreen } from '../components/HeroHourScreen';

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

  // Hero's Hour: other players at the same tile with enough units to fight
  // (not at King's Castle — it's neutral ground)
  const playersHere = board.players.filter(
    (p) => p.id !== player.id && p.position === player.position && p.units >= 5
  );
  if (playersHere.length > 0 && player.units >= 5 && !tile.name.includes('King')) {
    const tileOwner =
      tile.isOwned() && tile.owner !== player.id
        ? (board.players.find((p) => p.id === tile.owner) ?? null)
        : null;

    showScreen({
      content: React.createElement(HeroHourScreen, {
        activePlayer: player,
        opponents: playersHere,
        tile,
        tileOwner,
        gameState: board,
        updateGameState,
        onFightDone: () => setEndTurn(),
        onGreetDone: () => {
          if (tileOwner) {
            showTileEncounterScreen(board, updateGameState);
          } else {
            setEndTurn();
          }
        },
      }),
    });
    return;
  }

  if (tile.isOwned() && tile.owner !== player.id) {
    showTileEncounterScreen(board, updateGameState);
    return;
  }

  setEndTurn();
}

/** Show the guards / pay-fee / fight encounter for the active tile. */
export function showTileEncounterScreen(
  board: GameState,
  updateGameState: (board: GameState) => void
) {
  const player = board.activePlayer;
  const tile = board.activeTile;
  const owner = board.players.find((p) => p.id === tile.owner);

  // A jailed owner can't collect a fee or defend their land.
  const ownerInPrison =
    !!owner &&
    ((owner.turnsToSkip ?? 0) > 0 || board.tiles[owner.position]?.name === 'Prison');

  if (ownerInPrison) {
    say(
      `${owner!.name} is in prison, so others just send him the flowers 🌹 while visiting his property`,
      'info'
    );
    setEndTurn();
    return;
  }

  const fee = tile.fee;
  const defence = tile.defence;
  const ownerColor = owner?.color;

  const sellable = player.ownedTiles.reduce(
    (acc, posIdx) => {
      const t = board.tiles[posIdx];
      if (!t || t.owner !== player.id) return acc;
      acc.gold += t.currentPrice.gold;
      acc.units += t.currentPrice.units;
      return acc;
    },
    { gold: 0, units: 0 }
  );
  const canPay = player.gold >= fee;
  const canFight = player.units >= defence;
  const canSellForFee = !canPay && player.gold + sellable.gold >= fee;
  const canSellForFight = !canFight && player.units + sellable.units >= defence;
  const canSell = canSellForFee || canSellForFight;
  const showAcceptLoss = !canPay && !canFight && !canSell;

  const encounter = {
    playerName: player.name,
    playerColor: player.color,
    tileName: tile.name,
    tileFee: tile.fee,
    tileDefence: tile.defence,
    ownerName: owner?.name ?? undefined,
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

  const feeButton: ScreenButton = {
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
      player.isPrisonerOfWar = true;
      becomeBeggar(board, updateGameState);
      showPrisonScreen(board.gameMessage);
    },
  };

  const extraButtons: ScreenButton[] = [];
  if (canSell) {
    const sellModeConfig = {
      ...baseConfig,
      sellMode: true,
      sellHeader: `Sell tiles to pay the ${fee}🟡 fee, raise an army, or yield to ${owner?.name ?? 'the owner'}`,
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
}
