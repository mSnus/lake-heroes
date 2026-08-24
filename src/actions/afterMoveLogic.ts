import React from 'react';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { becomeBeggar } from './becomeBeggar';
import { showScreen, showPrisonScreen, clearScreen, ScreenButton } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { say } from '../utils/say';
import { payFee } from './payFee';
import { fightTile } from './fightTile';
import { sellTile } from './sellTile';
import { claimUndefendedTile } from './claimUndefendedTile';
import { HeroHourScreen } from '../components/HeroHourScreen';
import { computeFeeOptions, FeeOptions } from './feeOptions';
import { checkZombieAmbushEncounter } from './zombieAmbushEncounter';
import { getCharacterConfig, pickGuardsAction, pickHeroHourTarget } from '../ai/decisions';
import { pickWizardGuardsAction, sortTilesBySacrifice } from '../ai/wizardGuards';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { t } from '../i18n';

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
  // (not at King's Castle — it's neutral ground). Players with 0 units can
  // neither attack nor be attacked. Heroes who've circled the board 2 times
  // or fewer are too green for Hero's Hour, on either side of the encounter.
  const playersHere = board.players.filter(
    (p) =>
      p.id !== player.id &&
      p.position === player.position &&
      p.units > 0 &&
      (p.circles ?? 0) > 2
  );
  if (
    playersHere.length > 0 &&
    player.units > 0 &&
    (player.circles ?? 0) > 2 &&
    tile.id !== 'king-castle'
  ) {
    const tileOwner =
      tile.isOwned() && tile.owner !== player.id
        ? (board.players.find((p) => p.id === tile.owner) ?? null)
        : null;

    // Same decision HeroHourScreen's own self-drive effect makes, and the
    // same onFightDone/onGreetDone continuations it uses.
    if (isHeadlessRun()) {
      const target = pickHeroHourTarget(player, playersHere);
      if (target) {
        const battlefieldUnits = Math.min(player.units, target.units);
        showBattleScreen(
          { mode: 'player', attacker: player, defender: target, battlefieldUnits, gameState: board, updateGameState, onClose: () => setEndTurn() },
          { screenType: 'player-battle', defenderId: target.id, battlefieldUnits }
        );
      } else if (tileOwner) {
        showTileEncounterScreen(board, updateGameState);
      } else {
        setEndTurn();
      }
      return;
    }

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
            clearScreen();
            setEndTurn();
          }
        },
      }),
    });
    return;
  }

  if (tile.isOwned() && tile.owner !== player.id) {
    if (tile.isYielded) {
      say(t('afterMoveLogic.enjoysYieldedVisit', { playerName: player.name, tileName: tile.name }), 'info');
      setEndTurn();
      return;
    }
    // Already paid/fought/accepted the loss this turn -- a reload before End
    // Turn was clicked would otherwise re-derive and re-show the same
    // encounter from scratch, since turnPhase is still 'after-move' and
    // (short of a win) tile ownership hasn't changed.
    if (player.hasResolvedTileEncounterThisTurn) {
      setEndTurn();
      return;
    }
    showTileEncounterScreen(board, updateGameState);
    return;
  }

  // Landing on an abandoned (zombie-guarded) tile has a chance to ambush the
  // player — resolves like any other battle screen, then falls through to
  // end-turn same as always; the tile itself is untouched either way.
  if (!tile.isOwned() && tile.abandoned) {
    if (checkZombieAmbushEncounter(board, updateGameState, () => setEndTurn())) return;
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
    ((owner.turnsToSkip ?? 0) > 0 || board.tiles[owner.position]?.id === 'prison');

  if (ownerInPrison) {
    say(t('afterMoveLogic.ownerInPrison', { ownerName: owner!.name }), 'info');
    setEndTurn();
    return;
  }

  const ownerColor = owner?.color;

  const feeOptions = computeFeeOptions(board, player, tile);
  const { fee, defence, canPay, canFight, canSell, showAcceptLoss } = feeOptions;

  if (isHeadlessRun()) {
    resolveGuardsHeadless(board, updateGameState, tile, feeOptions);
    return;
  }

  // An empty garrison means nothing to fight — skip straight to a free,
  // no-battle takeover instead of the usual pay/fight/sell/accept-loss choice.
  if (defence === 0) {
    const encounter = {
      playerName: player.name,
      playerColor: player.color,
      tile,
      ownerName: owner?.name ?? undefined,
      ownerColor,
      canFight: false,
      fee,
      outcomeText: undefined,
      gold: player.gold,
      militia: player.militia,
      riders: player.riders,
    };

    showScreen({
      background: 'assets/screens/guards.jpg',
      fade: true,
      spriteImage: tile.spriteImage,
      encounter,
      buttons: [
        {
          label: t('afterMoveLogic.defencelessItsMine'),
          action: 'claim-undefended',
          onClick: () => claimUndefendedTile(board, updateGameState),
        },
      ],
    });
    return;
  }

  const encounter = {
    playerName: player.name,
    playerColor: player.color,
    tile,
    ownerName: owner?.name ?? undefined,
    ownerColor,
    canFight,
    fee,
    outcomeText: undefined,
    gold: player.gold,
    militia: player.militia,
    riders: player.riders,
  };

  const baseConfig = {
    background: 'assets/screens/guards.jpg',
    fade: true as const,
    spriteImage: tile.spriteImage,
    encounter,
  };

  const feeButton: ScreenButton = {
    label: t('afterMoveLogic.payFee', { fee }),
    action: 'pay-fee',
    onClick: () => payFee(board, updateGameState),
    disabled: player.gold < fee,
  };

  const baseButtons: ScreenButton[] = [
    feeButton,
    {
      label: t('afterMoveLogic.battle', { defence }),
      action: 'fight-tile',
      onClick: () => fightTile(board, updateGameState),
      disabled: !canFight,
    },
  ];

  const acceptLossButton: ScreenButton = {
    label: t('afterMoveLogic.acceptLoss'),
    action: 'accept-loss',
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
      sellHeader: t('afterMoveLogic.sellHeader', { fee }),
      buttons: baseButtons,
    };
    extraButtons.push({
      label: t('afterMoveLogic.sellTiles'),
      action: 'sell-tiles',
      onClick: () => showScreen(sellModeConfig),
    });
  }

  if (showAcceptLoss) extraButtons.push(acceptLossButton);
  showScreen({ ...baseConfig, buttons: [...baseButtons, ...extraButtons] });
}

/**
 * The guards encounter's pay/fight/sell/accept-loss decision, headless --
 * the exact same decision BotController's pickGenericScreenAction makes
 * (wizard strategy via pickWizardGuardsAction, otherwise pickGuardsAction),
 * just calling the target action directly instead of finding it by button
 * tag on a screen that was never shown.
 */
function resolveGuardsHeadless(
  board: GameState,
  updateGameState: (board: GameState) => void,
  tile: Tile,
  opts: FeeOptions
): void {
  const player = board.activePlayer;

  // An empty garrison is a free takeover, not a fight -- same shortcut the
  // real guards screen takes above (see the defence === 0 branch).
  if (opts.defence === 0) {
    claimUndefendedTile(board, updateGameState);
    return;
  }

  const cheapestFirst = () =>
    player.ownedTiles
      .map((idx) => board.tiles[idx])
      .filter((t): t is Tile => !!t && t.owner === player.id)
      .sort((a, b) => a.currentPrice.gold - b.currentPrice.gold);

  const sellThenResolve = (wantsToPay: boolean, only?: Tile, order: Tile[] = cheapestFirst()) => {
    const candidates = only ? [only] : order;
    for (const t of candidates) {
      const satisfied = wantsToPay ? player.gold >= opts.fee : player.armyPower >= opts.defence;
      if (satisfied) break;
      sellTile(board, player, t);
    }
    updateGameState(board);
    if (wantsToPay) payFee(board, updateGameState);
    else fightTile(board, updateGameState);
  };

  const acceptLoss = () => {
    player.isPrisonerOfWar = true;
    becomeBeggar(board, updateGameState);
    setEndTurn();
  };

  const cfg = getCharacterConfig(player);
  if (cfg?.guards.strategy === 'wizard') {
    const decision = pickWizardGuardsAction(board, player, tile, opts);
    switch (decision.kind) {
      case 'pay':
        payFee(board, updateGameState);
        return;
      case 'fight':
        fightTile(board, updateGameState);
        return;
      case 'sell-one-then-fight':
        sellThenResolve(false, decision.tile);
        return;
      case 'sell-one-then-pay':
        sellThenResolve(true, decision.tile);
        return;
      case 'sell-multiple-then-pay':
        sellThenResolve(true, undefined, sortTilesBySacrifice(board, player));
        return;
      case 'accept-loss':
        acceptLoss();
        return;
    }
    return;
  }

  const decision = pickGuardsAction(player, opts);
  if (decision === 'sell-then-resolve') sellThenResolve(opts.canSellForFee);
  else if (decision === 'pay') payFee(board, updateGameState);
  else if (decision === 'fight') fightTile(board, updateGameState);
  else acceptLoss();
}
