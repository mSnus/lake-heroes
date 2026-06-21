import { useEffect } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { ScreenConfig, useScreen } from '../utils/screenStore';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { endTurn } from '../actions/endTurn';
import { claimTile } from '../actions/claimTile';
import { sellTile } from '../actions/sellTile';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { computeFeeOptions } from '../actions/feeOptions';
import {
  getCharacterConfig,
  shouldClaimTile,
  pickUpgradeCandidate,
  shouldAttackCaravan,
  shouldChallengeDragon,
  pickGuardsAction,
} from '../ai/decisions';
import { findSyndicateSaleCandidate } from '../ai/syndicate';
import { pickWizardGuardsAction, sortTilesBySacrifice } from '../ai/wizardGuards';

// Matches the ~600ms auto-roll delay BattleScreen already uses for NPC sides.
const BOT_ACTION_DELAY_MS = 600;

function announce(player: Player, decision: string) {
  say(`${player.name} decided to ${decision}`, 'info');
}

interface Props {
  gameState: GameState | null;
  updateGameState: (gs: GameState) => void;
}

interface BotContext {
  board: GameState;
  player: Player;
  screen: ScreenConfig | null;
  diceActive: boolean;
  rolling: boolean;
  endTurnReady: boolean;
  updateGameState: (gs: GameState) => void;
}

function pickGenericScreenAction(ctx: BotContext): (() => void) | null {
  const { screen, player, board } = ctx;
  const buttons = screen?.buttons;
  if (!buttons || buttons.length === 0) return null;

  // Guards / fee encounter — identified by the `encounter` payload.
  if (screen!.encounter && screen!.encounter.canFight !== undefined) {
    const tile = board.activeTile;
    const opts = computeFeeOptions(board, player, tile);
    const cfg = getCharacterConfig(player);

    const cheapestFirst = () =>
      player.ownedTiles
        .map((idx) => board.tiles[idx])
        .filter((t): t is Tile => !!t && t.owner === player.id)
        .sort((a, b) => a.currentPrice.gold - b.currentPrice.gold);

    const sellThenResolve = (wantsToPay: boolean, only?: Tile, order: Tile[] = cheapestFirst()) => () => {
      // Bots skip the human-oriented sell-mode sub-screen and resolve directly.
      const candidates = only ? [only] : order;
      for (const t of candidates) {
        const satisfied = wantsToPay ? player.gold >= opts.fee : player.units >= opts.defence;
        if (satisfied) break;
        sellTile(board, player, t);
      }
      ctx.updateGameState(board);
      if (wantsToPay) payFee(board, ctx.updateGameState);
      else fightTile(board, ctx.updateGameState);
    };

    if (cfg?.guards.strategy === 'wizard') {
      const decision = pickWizardGuardsAction(board, player, tile, opts);
      switch (decision.kind) {
        case 'pay':
          announce(player, 'pay the fee');
          return buttons.find((b) => b.action === 'pay-fee')?.onClick ?? null;
        case 'fight':
          announce(player, 'fight');
          return buttons.find((b) => b.action === 'fight-tile')?.onClick ?? null;
        case 'sell-one-then-fight':
          announce(player, 'sell tiles to fight');
          return sellThenResolve(false, decision.tile);
        case 'sell-one-then-pay':
          announce(player, 'sell tiles to pay the fee');
          return sellThenResolve(true, decision.tile);
        case 'sell-multiple-then-pay':
          announce(player, 'sell tiles to pay the fee');
          return sellThenResolve(true, undefined, sortTilesBySacrifice(board, player));
        case 'accept-loss':
          return buttons.find((b) => b.action === 'accept-loss')?.onClick ?? null;
      }
    }

    const decision = pickGuardsAction(player, opts);
    if (decision === 'sell-then-resolve') {
      announce(player, opts.canSellForFee ? 'sell tiles to pay the fee' : 'sell tiles to fight');
      return sellThenResolve(opts.canSellForFee);
    }

    const actionByDecision: Record<string, string> = {
      pay: 'pay-fee',
      fight: 'fight-tile',
      'accept-loss': 'accept-loss',
    };
    if (decision === 'pay') announce(player, 'pay the fee');
    if (decision === 'fight') announce(player, 'fight');
    const button = buttons.find((b) => b.action === actionByDecision[decision]);
    return button ? button.onClick : null;
  }

  // Dragon challenge (proactive offer or random ambush) — screenType 'dragon'.
  if (screen!.screenType === 'dragon') {
    const fight = shouldChallengeDragon(player);
    if (fight) announce(player, 'fight the dragon');
    const button = buttons.find((b) => b.action === (fight ? 'fight' : 'continue'));
    return button ? button.onClick : null;
  }

  // Caravan — screenType 'caravan', buttons carry no action tag: [0]=pass, [1]=attack.
  if (screen!.screenType === 'caravan' && buttons.length === 2) {
    const attack = shouldAttackCaravan(player, screen!.caravanDefence ?? 0);
    return buttons[attack ? 1 : 0].onClick;
  }

  // Single-button "Continue"-style screens (prison, joker, dice prompts,
  // result screens, dragon-sky/dragon-attack, portal) — no real decision.
  if (buttons.length === 1) return buttons[0].onClick;

  return null;
}

function computeNextBotAction(ctx: BotContext): (() => void) | null {
  const { board, player, screen, diceActive, rolling, endTurnReady, updateGameState } = ctx;

  // Custom content: screens self-drive (HeroHourScreen, KingsCastleModal,
  // BattleScreen) — hand off entirely.
  if (screen?.content) return null;

  if (screen?.buttons?.length) {
    const action = pickGenericScreenAction(ctx);
    if (action) return action;
    return null; // unrecognized multi-button screen — don't guess
  }

  if (diceActive && !rolling) return () => startDiceRoll();
  if (diceActive && rolling) return null; // mid-animation, wait
  if (screen) return null; // some other screen we don't recognize is up

  // Claim decision — not a screen at all, TileCard's button calls claimTile().
  // Gated on hasConsideredClaimThisTurn (not hasClaimedThisTurn) so a "decide
  // not to claim" outcome is still recorded — otherwise, since that outcome
  // doesn't change any state, this branch would keep matching forever and
  // the bot would never progress to the upgrade/end-turn checks below.
  const tile = board.activeTile;
  if (
    board.turnPhase === 'after-move' &&
    tile.isOwnable &&
    !tile.isOwned() &&
    !player.hasConsideredClaimThisTurn
  ) {
    return () => {
      if (getCharacterConfig(player)?.buildsSyndicates && tile.requiredFame <= player.fame) {
        const saleCandidate = findSyndicateSaleCandidate(board, player, tile);
        if (saleCandidate) {
          sellTile(board, player, saleCandidate);
        }
      }
      player.hasConsideredClaimThisTurn = true;
      if (shouldClaimTile(player, tile)) {
        announce(player, `claim ${tile.name}`);
        claimTile(board, updateGameState);
      }
      updateGameState(board);
    };
  }

  // Upgrade decision — up to the character's per-turn cap, scanning all owned tiles.
  const upgradeCfg = getCharacterConfig(player);
  if (upgradeCfg && player.upgradesThisTurn < upgradeCfg.upgrade.maxPerTurn) {
    const candidate = pickUpgradeCandidate(board, player);
    if (candidate) {
      return () => {
        const price = candidate.prices[candidate.level + 1];
        player.gold -= price.gold;
        player.units -= price.units;
        candidate._level = candidate.level + 1;
        player.upgradesThisTurn += 1;
        updateGameState(board);
      };
    }
  }

  if (endTurnReady) {
    return () => {
      // Matches ShieldColumn/ActionBar's human end-turn path: clears any
      // tile a human inspector had pinned and resets the phase, otherwise
      // the bot's last-viewed tile sticks around into the next turn.
      gameEvent('setPhase', 'before-move');
      gameEvent('displayTile', {});
      endTurn(board, updateGameState);
    };
  }

  return null;
}

export function BotController({ gameState, updateGameState }: Props) {
  const screen = useScreen();
  const { active: diceActive, rolling } = useModal();
  const endTurnReady = useEndTurnReady();

  useEffect(() => {
    const player = gameState?.activePlayer;
    if (!gameState || !player?.isComputer) return;

    const action = computeNextBotAction({
      board: gameState,
      player,
      screen,
      diceActive,
      rolling,
      endTurnReady,
      updateGameState,
    });
    if (!action) return;

    const t = setTimeout(action, BOT_ACTION_DELAY_MS);
    return () => clearTimeout(t);
  }, [gameState, screen, diceActive, rolling, endTurnReady, updateGameState]);

  return null;
}
