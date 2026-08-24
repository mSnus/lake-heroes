import { useEffect } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { ScreenConfig, useScreen } from '../utils/screenStore';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { isHalted } from '../utils/haltStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { endTurn } from '../actions/endTurn';
import { claimTile } from '../actions/claimTile';
import { sellTile } from '../actions/sellTile';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { computeFeeOptions } from '../actions/feeOptions';
import { setTileGarrison } from '../actions/garrisonTile';
import {
  getCharacterConfig,
  shouldClaimTile,
  pickUpgradeCandidate,
  shouldAttackCaravan,
  shouldChallengeDragon,
  pickGuardsAction,
  pickGarrisonAction,
  pickForkChoice,
} from '../ai/decisions';
import { findSyndicateSaleCandidate } from '../ai/syndicate';
import { pickWizardGuardsAction, sortTilesBySacrifice } from '../ai/wizardGuards';
import { FORK_START_INDEX } from '../game/constants';
import { setForkChoice } from '../utils/forkChoiceStore';
import { t } from '../i18n';

// Matches the ~600ms auto-roll delay BattleScreen already uses for NPC sides.
const BOT_ACTION_DELAY_MS = 600;
// Closing a result screen gets a beat longer, so a human watching has time
// to read the outcome before it's dismissed.
const BOT_CLOSE_DELAY_MS = 800;

/** `decisionKey` is an i18n key (translated fresh at call time — this file
 * has no React render cycle to subscribe to language changes, but that's
 * fine since these are one-shot toasts fired in direct response to a bot
 * action, always reading whatever language is active right now). */
function announce(player: Player, decisionKey: string, params?: Record<string, string | number>) {
  say(t('botController.decided', { name: player.name, decision: t(decisionKey, params) }), 'info');
}

interface BotAction {
  run: () => void;
  delayMs: number;
}

function action(run: () => void, delayMs: number = BOT_ACTION_DELAY_MS): BotAction {
  return { run, delayMs };
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

function pickGenericScreenAction(ctx: BotContext): BotAction | null {
  const { screen, player, board } = ctx;
  const buttons = screen?.buttons;
  if (!buttons || buttons.length === 0) return null;

  // Undefended tile — a single free-takeover button, no decision to make.
  const claimUndefended = buttons.find((b) => b.action === 'claim-undefended');
  if (claimUndefended) {
    announce(player, 'botController.takeUndefendedTile');
    return action(claimUndefended.onClick);
  }

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
        const satisfied = wantsToPay ? player.gold >= opts.fee : player.armyPower >= opts.defence;
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
          announce(player, 'botController.payTheFee');
          return action(buttons.find((b) => b.action === 'pay-fee')?.onClick ?? (() => {}));
        case 'fight':
          announce(player, 'botController.fight');
          return action(buttons.find((b) => b.action === 'fight-tile')?.onClick ?? (() => {}));
        case 'sell-one-then-fight':
          announce(player, 'botController.sellTilesToFight');
          return action(sellThenResolve(false, decision.tile));
        case 'sell-one-then-pay':
          announce(player, 'botController.sellTilesToPayFee');
          return action(sellThenResolve(true, decision.tile));
        case 'sell-multiple-then-pay':
          announce(player, 'botController.sellTilesToPayFee');
          return action(sellThenResolve(true, undefined, sortTilesBySacrifice(board, player)));
        case 'accept-loss':
          announce(player, 'botController.acceptTheLoss');
          return action(buttons.find((b) => b.action === 'accept-loss')?.onClick ?? (() => {}));
      }
    }

    const decision = pickGuardsAction(player, opts);
    if (decision === 'sell-then-resolve') {
      announce(player, opts.canSellForFee ? 'botController.sellTilesToPayFee' : 'botController.sellTilesToFight');
      return action(sellThenResolve(opts.canSellForFee));
    }

    const actionByDecision: Record<string, string> = {
      pay: 'pay-fee',
      fight: 'fight-tile',
      'accept-loss': 'accept-loss',
    };
    if (decision === 'pay') announce(player, 'botController.payTheFee');
    if (decision === 'fight') announce(player, 'botController.fight');
    if (decision === 'accept-loss') announce(player, 'botController.acceptTheLoss');
    const button = buttons.find((b) => b.action === actionByDecision[decision]);
    return button ? action(button.onClick) : null;
  }

  // Dragon challenge (proactive offer or random ambush) — screenType 'dragon'.
  if (screen!.screenType === 'dragon') {
    const fight = shouldChallengeDragon(player);
    if (fight) announce(player, 'botController.fightTheDragon');
    const button = buttons.find((b) => b.action === (fight ? 'fight' : 'continue'));
    return button ? action(button.onClick) : null;
  }

  // Caravan — screenType 'caravan', buttons carry no action tag: [0]=pass, [1]=attack.
  if (screen!.screenType === 'caravan' && buttons.length === 2) {
    const attack = shouldAttackCaravan(player, screen!.caravanDefence ?? 0);
    if (attack) announce(player, 'botController.attackTheCaravan');
    return action(buttons[attack ? 1 : 0].onClick);
  }

  // Single-button "Continue"-style screens (prison, joker, dice prompts,
  // result screens, dragon-sky/dragon-attack, portal) — no real decision, just
  // dismissing a screen, so give it the longer close delay.
  if (buttons.length === 1) return action(buttons[0].onClick, BOT_CLOSE_DELAY_MS);

  return null;
}

function computeNextBotAction(ctx: BotContext): BotAction | null {
  const { board, player, screen, diceActive, rolling, endTurnReady, updateGameState } = ctx;

  // Custom content: screens self-drive (HeroHourScreen, KingsCastleModal,
  // BattleScreen) — hand off entirely.
  if (screen?.content) return null;

  if (screen?.buttons?.length) {
    return pickGenericScreenAction(ctx); // unrecognized multi-button screen -> null, don't guess
  }

  if (diceActive && !rolling) {
    return action(() => {
      // Standing on the fork's start tile about to roll -- pick a path (see
      // pickForkChoice) before rolling, same spot a human's turn-announcement
      // buttons would set it. rollAndMove.ts reads it once and resets it
      // right after, so it's fine to always (re-)set it here regardless.
      if (board.turnPhase === 'before-move' && player.position === FORK_START_INDEX) {
        setForkChoice(pickForkChoice(player.character));
      }
      startDiceRoll();
    });
  }
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
    return action(() => {
      if (getCharacterConfig(player)?.buildsSyndicates && tile.requiredFame <= player.fame) {
        const saleCandidate = findSyndicateSaleCandidate(board, player, tile);
        if (saleCandidate) {
          announce(player, 'botController.sellForSyndicate', { saleName: saleCandidate.name, tileName: tile.name });
          sellTile(board, player, saleCandidate);
        }
      }
      player.hasConsideredClaimThisTurn = true;
      if (shouldClaimTile(player, tile, board)) {
        announce(player, 'botController.claimTile', { tileName: tile.name });
        claimTile(board, updateGameState);
      }
      updateGameState(board);
    });
  }

  // Upgrade decision — up to the character's per-turn cap, scanning all owned tiles.
  const upgradeCfg = getCharacterConfig(player);
  if (upgradeCfg && player.upgradesThisTurn < upgradeCfg.upgrade.maxPerTurn) {
    const candidate = pickUpgradeCandidate(board, player);
    if (candidate) {
      return action(() => {
        const price = candidate.prices[candidate.level + 1];
        player.gold -= price.gold;
        player.units -= price.units;
        candidate._level = candidate.level + 1;
        player.upgradesThisTurn += 1;
        updateGameState(board);
      });
    }
  }

  // Garrison decision — top up the weakest-defended owned tile once claim/
  // upgrade decisions for this tick are exhausted.
  const garrisonPick = pickGarrisonAction(board, player);
  if (garrisonPick) {
    return action(() => {
      announce(player, 'botController.garrisonTile', { amount: garrisonPick.amount, tileName: garrisonPick.tile.name });
      setTileGarrison(
        board,
        player,
        garrisonPick.tile,
        garrisonPick.tile.garrisonMilitia + garrisonPick.amount
      );
      updateGameState(board);
    });
  }

  if (endTurnReady) {
    return action(() => {
      // Matches ShieldColumn/ActionBar's human end-turn path: clears any
      // tile a human inspector had pinned and resets the phase, otherwise
      // the bot's last-viewed tile sticks around into the next turn.
      gameEvent('setPhase', 'before-move');
      gameEvent('displayTile', {});
      endTurn(board, updateGameState);
      // endTurn() already advanced board.activePlayerIndex synchronously,
      // so board.activePlayer here is the next player up.
      setTimeout(() => say(`${board.activePlayer.name}'s turn`, 'info'), 500);
    });
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

    const nextAction = computeNextBotAction({
      board: gameState,
      player,
      screen,
      diceActive,
      rolling,
      endTurnReady,
      updateGameState,
    });
    if (!nextAction) return;

    // Re-checked inside the timer, not just here: the game can be torn down
    // during the delay, and this action captures the board it was planned for.
    const t = setTimeout(() => {
      if (isHalted()) return;
      nextAction.run();
    }, nextAction.delayMs);
    return () => clearTimeout(t);
  }, [gameState, screen, diceActive, rolling, endTurnReady, updateGameState]);

  return null;
}
