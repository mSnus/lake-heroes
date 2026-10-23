import { isLocallyDriven } from '../game/seats';
import { useEffect } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { ScreenConfig, useScreen } from '../utils/screenStore';
import { useModal, startDiceRoll } from '../utils/diceStore';
import { isHalted } from '../utils/haltStore';
import { useEndTurnReady } from '../utils/endTurnStore';
import { gameEvent } from '../utils/events';
import { announce } from '../utils/announce';
import { endTurn } from '../actions/endTurn';
import { claimTile } from '../actions/claimTile';
import { sellTile } from '../actions/sellTile';
import { afterMoveLogic } from '../actions/afterMoveLogic';
import { setTileGarrison } from '../actions/garrisonTile';
import {
  getCharacterConfig,
  shouldClaimTile,
  pickUpgradeCandidate,
  shouldAttackCaravan,
  shouldChallengeDragon,
  shouldSeekRevenge,
  sortTilesBySacrifice,
  pickGarrisonAction,
  pickForkChoice,
} from '../ai/decisions';
import { findSyndicateSaleCandidate } from '../ai/syndicate';
import { FORK_START_INDEX } from '../game/constants';
import { setForkChoice } from '../utils/forkChoiceStore';

// Matches the ~600ms auto-roll delay BattleScreen already uses for NPC sides.
const BOT_ACTION_DELAY_MS = 600;
// Closing a result screen gets a beat longer, so a human watching has time
// to read the outcome before it's dismissed.
const BOT_CLOSE_DELAY_MS = 800;

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

  // Guards / toll encounter — identified by the `encounter` payload. By the
  // time any such screen shows, the toll itself has already been auto-paid
  // (or the player already sent to prison) inside showTileEncounterScreen --
  // all that's left for a bot to decide is whether to sell toward a
  // shortfall, or seek revenge once the toll is settled.
  if (screen!.encounter && screen!.encounter.canFight !== undefined) {
    const tile = board.activeTile;

    // Sell-to-pay-or-POW: keep selling the least valuable tile until the
    // toll is covered -- guaranteed to succeed, since this screen only ever
    // shows when selling everything would be enough (see
    // afterMoveLogic.ts's showTileEncounterScreen). One sale per tick,
    // re-checking afterward exactly like a human's sell-mode UI does.
    if (screen!.sellMode) {
      const target = sortTilesBySacrifice(board, player)[0];
      if (!target) {
        return action(buttons.find((b) => b.action === 'accept-loss')?.onClick ?? (() => {}));
      }

      announce(player, 'botController.sellTilesToPayFee');
      return action(() => {
        sellTile(board, player, target);
        afterMoveLogic(board, ctx.updateGameState);
      });
    }

    // Peace or revenge -- the toll is already settled by now.
    const revenge = shouldSeekRevenge(player, tile.defence);
    if (revenge) announce(player, 'botController.fight', { tile: tile.shortName });
    else announce(player, 'botController.noRevenge');
    const button = buttons.find((b) => b.action === (revenge ? 'fight-tile' : 'go-with-peace'));
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

  // Harvest round: the bot already traded in beginHarvestTurn -- nothing else
  // to do but end the turn.
  if (board.harvest) {
    return endTurnReady ? action(() => endTurn(board, updateGameState)) : null;
  }

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
        player.gold -= candidate.prices[candidate.level + 1];
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
      player.garrisonSpentThisTurn = (player.garrisonSpentThisTurn ?? 0) + garrisonPick.amount;
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
    // isLocallyDriven: online, exactly one client drives each bot (the host),
    // or every connected player would run the same bot turn independently.
    // Offline it is always true, so this is unchanged for a local game.
    if (!gameState || !player?.isComputer || !isLocallyDriven(player, gameState)) return;

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
