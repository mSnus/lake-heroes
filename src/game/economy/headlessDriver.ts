import { GameState } from '../GameState';
import { rollDice } from '../Dice';
import { rollAndMove } from '../../actions/rollAndMove';
import { endTurn } from '../../actions/endTurn';
import { claimTile } from '../../actions/claimTile';
import { sellTile } from '../../actions/sellTile';
import { setTileGarrison } from '../../actions/garrisonTile';
import { setHeadlessRun } from '../../utils/headlessStore';
import { resetEndTurn } from '../../utils/endTurnStore';
import { setSimLogBoard, resetSimLog } from '../../utils/simLogStore';
import { announce } from '../../utils/announce';
import {
  getCharacterConfig,
  shouldClaimTile,
  pickUpgradeCandidate,
  pickGarrisonAction,
} from '../../ai/decisions';
import { findSyndicateSaleCandidate } from '../../ai/syndicate';

export interface HeadlessGameOptions {
  /** Hard cap on the highest circle count reached by any player. */
  maxCircles?: number;
}

export type HeadlessStopReason = 'circle-cap' | 'game-over';

export interface HeadlessGameResult {
  stopReason: HeadlessStopReason;
  turnsPlayed: number;
}

const DEFAULT_MAX_CIRCLES = 50;

/**
 * Same claim/upgrade/garrison decisions BotController's computeNextBotAction
 * makes for a bot once movement and any encounter have resolved — those
 * aren't screen-driven at all (a human acts on them via plain tile-card
 * buttons), so they need their own direct call here rather than going
 * through the headless branches other actions have.
 */
function driveBotPostMoveDecisions(board: GameState, updateGameState: (board: GameState) => void): void {
  const player = board.activePlayer;
  const tile = board.activeTile;

  if (
    board.turnPhase === 'after-move' &&
    tile.isOwnable &&
    !tile.isOwned() &&
    !player.hasConsideredClaimThisTurn
  ) {
    const cfg = getCharacterConfig(player);
    if (cfg?.buildsSyndicates && tile.requiredFame <= player.fame) {
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
  }

  const upgradeCfg = getCharacterConfig(player);
  if (upgradeCfg) {
    let candidate =
      player.upgradesThisTurn < upgradeCfg.upgrade.maxPerTurn ? pickUpgradeCandidate(board, player) : null;
    while (candidate) {
      player.gold -= candidate.prices[candidate.level + 1];
      candidate._level = candidate.level + 1;
      player.upgradesThisTurn += 1;
      updateGameState(board);
      candidate =
        player.upgradesThisTurn < upgradeCfg.upgrade.maxPerTurn ? pickUpgradeCandidate(board, player) : null;
    }
  }

  let garrisonPick = pickGarrisonAction(board, player);
  while (garrisonPick) {
    announce(player, 'botController.garrisonTile', { amount: garrisonPick.amount, tileName: garrisonPick.tile.name });
    setTileGarrison(board, player, garrisonPick.tile, garrisonPick.tile.garrisonMilitia + garrisonPick.amount);
    player.garrisonSpentThisTurn = (player.garrisonSpentThisTurn ?? 0) + garrisonPick.amount;
    updateGameState(board);
    garrisonPick = pickGarrisonAction(board, player);
  }
}

/**
 * One player's turn cycle: forfeit it outright if they're serving a prison
 * skip (endTurn() itself detects and decrements that, for whichever player
 * it advances onto — board.skippingTurn is the reliable read of "did that
 * just happen" since the endTurnStore ready flag isn't meant to be
 * introspected this way), otherwise roll, resolve, and let the bot act.
 */
async function driveOneTurn(board: GameState, updateGameState: (board: GameState) => void): Promise<void> {
  if (board.skippingTurn || board.harvest) {
    endTurn(board, updateGameState);
    return;
  }

  resetEndTurn();
  await rollAndMove(board, updateGameState, rollDice());
  driveBotPostMoveDecisions(board, updateGameState);
  if (!board.gameOver) endTurn(board, updateGameState);
}

/**
 * Drives an AI-only GameState to completion with nothing rendered — no map,
 * screens, dice or battles — reusing the real turn-logic functions
 * (rollAndMove/endTurn/afterMoveLogic and everything under them) via their
 * isHeadlessRun() branches, so the sim can never drift from how a real game
 * actually plays out.
 */
export async function runHeadlessGame(
  board: GameState,
  updateGameState: (board: GameState) => void,
  options: HeadlessGameOptions = {}
): Promise<HeadlessGameResult> {
  const maxCircles = options.maxCircles ?? DEFAULT_MAX_CIRCLES;

  setHeadlessRun(true);
  resetSimLog();
  setSimLogBoard(board);
  try {
    for (;;) {
      if (Math.max(...board.players.map((p) => p.circles)) >= maxCircles) {
        return { stopReason: 'circle-cap', turnsPlayed: board.turns };
      }

      await driveOneTurn(board, updateGameState);

      if (board.gameOver) {
        return { stopReason: 'game-over', turnsPlayed: board.turns };
      }
    }
  } finally {
    setHeadlessRun(false);
    setSimLogBoard(null);
  }
}
