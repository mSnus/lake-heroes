import React from 'react';
import { Tile } from '../game/Tile';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { becomeBeggar } from './becomeBeggar';
import { showScreen, showPrisonScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { say } from '../utils/say';
import { fightTile } from './fightTile';
import { sellTile } from './sellTile';
import { claimUndefendedTile } from './claimUndefendedTile';
import { HeroHourScreen } from '../components/HeroHourScreen';
import { computeFeeOptions, FeeOptions } from './feeOptions';
import { checkZombieAmbushEncounter } from './zombieAmbushEncounter';
import { getCharacterConfig, shouldSeekRevenge, sortTilesBySacrifice, pickHeroHourTarget } from '../ai/decisions';
import { showBattleScreen } from '../game/battleGrid/battleResolution';
import { announce } from '../utils/announce';
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

/**
 * Auto-charges as much of the tile's toll as the player can currently
 * afford, transferring gold to the owner immediately -- paying is no
 * longer a choice, only whether to also seek revenge afterward is (see
 * showTileEncounterScreen). `player.owedToll` remembers what's still due
 * across repeated calls this encounter (e.g. after selling a tile to help
 * cover it), so re-entering never charges the same toll twice. Returns the
 * amount still owed after this charge -- 0 means it's fully settled.
 */
function chargeToll(player: Player, owner: Player | undefined, tile: Tile, fee: number): number {
  const owed = player.owedToll > 0 ? player.owedToll : fee;
  const payNow = Math.min(player.gold, owed);
  if (payNow > 0) {
    player.gold -= payNow;
    if (owner) owner.gold += payNow;
    say(t('payFee.paid', { playerName: player.name, fee: payNow, ownerName: owner?.name ?? '', tileName: tile.name }), 'info');
  }

  const remaining = owed - payNow;
  player.owedToll = remaining;
  if (remaining > 0) {
    say(
      t('afterMoveLogic.tollShortfall', { playerName: player.name, paid: payNow, remaining, tileName: tile.name }),
      'warning'
    );
  }

  return remaining;
}

/** Ends the encounter as a prisoner of war -- the toll couldn't be fully
 * covered even after selling everything sellable (or there was nothing to
 * sell at all). Mirrors the old "accept loss" button's consequences
 * exactly, just triggered automatically instead of by manual choice. */
function triggerPrisonerOfWar(board: GameState, updateGameState: (board: GameState) => void): void {
  const player = board.activePlayer;
  player.owedToll = 0;
  player.isPrisonerOfWar = true;
  becomeBeggar(board, updateGameState);
  if (isHeadlessRun()) setEndTurn();
  else showPrisonScreen(board.gameMessage);
}

/** The toll is fully paid -- show the peace/revenge choice. Revenge (a
 * banzai attack) is now purely optional payback, never a way to dodge the
 * toll itself, which has already changed hands by the time this shows. */
function showPeaceOrRevengeScreen(
  board: GameState,
  updateGameState: (board: GameState) => void,
  tile: Tile,
  owner: Player | undefined,
  canFight: boolean,
  fee: number
): void {
  const player = board.activePlayer;
  player.hasSettledTollThisTurn = true;

  const encounter = {
    playerName: player.name,
    playerColor: player.color,
    tile,
    ownerName: owner?.name ?? undefined,
    ownerColor: owner?.color,
    canFight,
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
        label: t('afterMoveLogic.goWithPeace'),
        action: 'go-with-peace',
        onClick: () => {
          player.hasResolvedTileEncounterThisTurn = true;
          clearScreen();
          setEndTurn();
        },
      },
      {
        label: t('afterMoveLogic.revenge'),
        action: 'fight-tile',
        onClick: () => fightTile(board, updateGameState),
        disabled: !canFight,
      },
    ],
  });
}

/** Short of funds even after handing over everything -- offer to sell
 * tiles to make up the difference, since doing so is guaranteed to cover
 * it (that's exactly the condition that routes here; see
 * showTileEncounterScreen). Selling re-triggers afterMoveLogic (see
 * ScreenRenderer's sellAndRecheck), which re-enters this same encounter and
 * automatically advances to the peace/revenge screen the moment enough has
 * been raised -- the only button here is for giving up early instead. */
function showSellToPayOrPOWScreen(
  board: GameState,
  updateGameState: (board: GameState) => void,
  tile: Tile,
  owner: Player | undefined,
  fee: number
): void {
  const player = board.activePlayer;
  const encounter = {
    playerName: player.name,
    playerColor: player.color,
    tile,
    ownerName: owner?.name ?? undefined,
    ownerColor: owner?.color,
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
    sellMode: true,
    sellHeader: t('afterMoveLogic.sellToPayOrPOW'),
    buttons: [
      {
        label: t('afterMoveLogic.becomePOW'),
        action: 'accept-loss',
        onClick: () => triggerPrisonerOfWar(board, updateGameState),
      },
    ],
  });
}

/** Show the guards / toll / revenge encounter for the active tile. */
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

  const feeOptions = computeFeeOptions(board, player, tile);
  const { fee, defence, canFight, sellable, hasSellableTiles } = feeOptions;

  if (isHeadlessRun()) {
    resolveGuardsHeadless(board, updateGameState, tile, feeOptions);
    return;
  }

  // An empty garrison means nothing to fight and no one to collect a toll —
  // skip straight to a free, no-battle takeover.
  if (defence === 0) {
    const encounter = {
      playerName: player.name,
      playerColor: player.color,
      tile,
      ownerName: owner?.name ?? undefined,
      ownerColor: owner?.color,
      canFight: false,
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

  // A re-entry after the toll was already settled this turn (e.g. a lost
  // revenge attack re-shows this encounter) -- go straight back to the
  // peace/revenge choice without charging anything again.
  if (player.hasSettledTollThisTurn) {
    showPeaceOrRevengeScreen(board, updateGameState, tile, owner, canFight, fee);
    return;
  }

  const remaining = chargeToll(player, owner, tile, fee);
  updateGameState(board);

  if (remaining <= 0) {
    showPeaceOrRevengeScreen(board, updateGameState, tile, owner, canFight, fee);
    return;
  }

  if (hasSellableTiles && sellable.gold >= remaining) {
    showSellToPayOrPOWScreen(board, updateGameState, tile, owner, fee);
  } else {
    triggerPrisonerOfWar(board, updateGameState);
  }
}

/**
 * The guards encounter, headless -- the same auto-charge/sell/revenge flow
 * showTileEncounterScreen drives for a real game, just calling the target
 * action directly instead of a button that was never shown.
 */
function resolveGuardsHeadless(
  board: GameState,
  updateGameState: (board: GameState) => void,
  tile: Tile,
  opts: FeeOptions
): void {
  const player = board.activePlayer;
  const owner = board.players.find((p) => p.id === tile.owner);

  // An empty garrison is a free takeover, not a fight -- same shortcut the
  // real guards screen takes above (see the defence === 0 branch).
  if (opts.defence === 0) {
    announce(player, 'botController.takeUndefendedTile');
    claimUndefendedTile(board, updateGameState);
    return;
  }

  let remaining = player.hasSettledTollThisTurn ? 0 : chargeToll(player, owner, tile, opts.fee);
  updateGameState(board);

  if (remaining > 0) {
    if (opts.hasSellableTiles && opts.sellable.gold >= remaining) {
      announce(player, 'botController.sellTilesToPayFee');
      for (const t of sortTilesBySacrifice(board, player)) {
        if (remaining <= 0) break;
        sellTile(board, player, t);
        remaining = chargeToll(player, owner, tile, opts.fee);
      }

      updateGameState(board);
    }
  }

  if (remaining > 0) {
    announce(player, 'botController.acceptTheLoss');
    triggerPrisonerOfWar(board, updateGameState);
    return;
  }

  player.hasSettledTollThisTurn = true;
  if (shouldSeekRevenge(board, player, tile, opts.defence)) {
    announce(player, 'botController.fight', { tile: tile.shortName });
    fightTile(board, updateGameState);
  } else {
    announce(player, 'botController.goWithPeace');
    player.hasResolvedTileEncounterThisTurn = true;
    setEndTurn();
  }
}
