import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { handleTreasureBox } from './treasureBox';
import { handleTavern } from './tavern';
import { handleStables } from './stables';
import { handlePrison } from './prison';
import { handleSphynx } from './sphynx';
import { handleKingCastle } from './king';
import { handleJoker } from './joker';
import { handlePortal } from './portal';
import { handleVisitOwnTile } from './visitOwnTile';
import { passStart } from './passStart';
import { afterMoveLogic } from './afterMoveLogic';
import { revealTile } from './revealTile';
import { showRuinsEncounter } from './ruinsEncounter';
import { say, narrate, narrateMove } from '../utils/say';
import { Route, routesFor, shortestSteps } from '../game/boardPath';
import { requestDestination } from '../utils/destinationChoiceStore';
import { pickDestination } from '../ai/decisions';
import { KARMA_PRISON_CHANCE } from '../game/constants';
import { setEndTurn } from '../utils/endTurnStore';
import { gameEvent } from '../utils/events';
import { isHalted } from '../utils/haltStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { setGameMessage } from '../utils/gameMessage';
import { recordSimTileVisit } from '../utils/simLogStore';
import { showTreasureScreen, showTavernScreen, showSphynxScreen } from '../utils/screenStore';
import { checkDragonEncounter } from './dragonEncounter';
import { checkCaravanEncounter } from './caravanEncounter';
import { checkAmbushEncounter } from './ambushEncounter';
import { checkRogueAttackEncounter } from './rogueAttackEncounter';
import { checkWorkersEncounter } from './workersEncounter';
import { checkJokerEncounter } from './jokerEncounter';
import { checkKnightPromotion } from './knightPromotion';
import { tickWildGarrisons } from '../game/wildGarrison';
import { consumeBattleWon } from '../utils/battleOutcomeStore';
import { t } from '../i18n';

export async function rollAndMove(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  preRolledValue?: number
) {
    if (!board) return;

  // Use the value already rolled by the dice widget (avoids re-triggering the animation)
  let roll = preRolledValue !== undefined ? preRolledValue : rollDice();
  const player = board.activePlayer;

  // A cursed player's die is quietly loaded whenever Prison sits within a
  // single roll, and Prison is then the only destination offered.
  let forcedDest: number | null = null;
  if (player.karma < 0) {
    const prisonIdx = board.tiles.findIndex((t) => t?.id === 'prison');
    if (prisonIdx >= 0) {
      const distance = shortestSteps(board, player.position, prisonIdx);
      if (distance >= 1 && distance <= 6 && Math.random() < KARMA_PRISON_CHANCE) {
        roll = distance;
        forcedDest = prisonIdx;
      }
    }
  }

  const allRoutes = routesFor(board, player.position, roll);
  const routes = forcedDest !== null ? allRoutes.filter((r) => r.dest === forcedDest) : allRoutes;

  gameEvent('setPhase', 'rolling');
  setGameMessage(board, '');
  gameEvent('displayTile', {});

  const chooseRoute = async (): Promise<Route> => {
    if (routes.length === 1) return routes[0];
    if (player.isComputer || isHeadlessRun()) return pickDestination(board, player, routes);
    const dest = await requestDestination(routes.map((r) => r.dest));
    return routes.find((r) => r.dest === dest)!;
  };

  const announceDestination = (dest: number) => {
    const nextTile = board.tiles[dest];
    let tileMessage = t('rollAndMove.rolledAndWentTo', { playerName: player.name, roll, tileName: nextTile.name });

    if (!nextTile.isOwned()) {
      const cannotBuy =
        player.gold < nextTile.currentPrice.gold || player.fame < nextTile.requiredFame;
      const defenceTooStrong = player.armyPower < nextTile.getDefence(1);

      if (cannotBuy || defenceTooStrong) {
        const reasons = [
          ...(cannotBuy ? [t('rollAndMove.cannotBuyIt')] : []),
          ...(defenceTooStrong ? [t('rollAndMove.defenceTooStrong')] : []),
        ];
        tileMessage += t('rollAndMove.butReasons', { reasons: reasons.join(` ${t('common.and')} `) });
      }
    }

    say(tileMessage, 'debug');
    // Logged as 'debug' locally but broadcast: to other players it's the only sign of the move.
    narrate(tileMessage);
  };

  const proceedWithMove = async () => {
    const route = await chooseRoute();
    if (isHalted()) return;
    const willCrossStart = route.crossesStart;
    announceDestination(route.dest);

    // Step-by-step move with 0.2s delay per tile
    for (let step = 1; step <= route.path.length; step++) {
      // The game was torn down (new game) while this loop was awaiting --
      // stop rather than keep mutating a board that nothing owns any more.
      if (isHalted()) return;

      const nextPos = route.path[step - 1];
      const willWrap = nextPos === 0;

      gameEvent('setPhase', 'moving');
      player.position = nextPos;
      updateGameState(board);
      narrateMove(nextPos);

      if (willWrap) passStart(board, updateGameState);

      // Only the tile the move actually ENDS on counts as "landed on" --
      // tiles merely stepped over mid-roll (including a King's Castle
      // crossing that isn't also this move's last step) don't get logged.
      // Read AFTER the possible passStart above, so a landing that IS the
      // King's Castle crossing (which bumps player.circles inside
      // passStart) logs under the NEW circle it just started, not the one
      // this move began in.
      if (isHeadlessRun() && step === roll) recordSimTileVisit(board.tiles[nextPos].shortName);

      if (!isHeadlessRun()) {
        await new Promise((res) => setTimeout(res, 300));
      }
    }

    if (isHalted()) return;

    board.setPhase('after-move');
    board.incTurns();
    tickWildGarrisons(board);
    const wasFogged = board.activeTile.fog;
    board.activeTile.fog = false;
    if (wasFogged) {
      revealTile(board);
    }

    // Show only the final tile the player landed on (the tiles passed over
    // during the roll stayed hidden) -- and only if it's an ownable tile.
    // Special tiles (King's Castle, Treasure Chest, etc.) get their own
    // dedicated screen right below via continueTileLogic, so auto-showing
    // the plain tile card underneath it would just be a redundant flash.
    // Skipped entirely if an "encounter" battle (rogue/caravan/dragon/
    // ambush) was just won -- those interrupt movement before this point,
    // so this would otherwise be the first time the card shows, popping up
    // right after the player already saw a dedicated win screen.
    if (!consumeBattleWon()) {
      gameEvent('displayTile', board.activeTile.isOwnable ? board.activeTile : {});
    }

    updateGameState(board);

    const continueTileLogic = () => {
      const tile = board.activeTile;
      // Treasure/Tavern/Sphynx normally roll via the animated DiceModal
      // (showDice, a module singleton entirely separate from screenStore --
      // not gated by isHeadlessRun) -- too slow for a sim anyway, so call
      // the handler straight with a synchronous roll instead of showing it.
      if (tile.id === 'treasure-chest') {
        if (isHeadlessRun()) {
          handleTreasureBox(board, updateGameState, rollDice());
          return;
        }

        showTreasureScreen(t('treasureBox.treasureFound'), (roll) =>
          handleTreasureBox(board, updateGameState, roll)
        );
        return;
      }

      if (tile.id === 'tavern') {
        if (isHeadlessRun()) {
          handleTavern(board, updateGameState, rollDice());
          return;
        }

        showTavernScreen(tile.name, (roll) => handleTavern(board, updateGameState, roll));
        return;
      }

      if (tile.id === 'stables') {
        handleStables(board, updateGameState);
        return;
      }

      if (tile.id === 'prison') {
        handlePrison(board, updateGameState);
        return;
      }

      if (tile.id === 'sphynx') {
        if (isHeadlessRun()) {
          handleSphynx(board, updateGameState, rollDice());
          return;
        }

        showSphynxScreen((roll) => handleSphynx(board, updateGameState, roll));
        return;
      }

      if (tile.id === 'portal') {
        handlePortal(board, updateGameState, continueTileLogic);
        return;
      }

      if (tile.id === 'king-castle') {
        handleKingCastle(board, updateGameState);
        return;
      }

      if (tile.id === 'joker') {
        handleJoker(board, updateGameState);
        return;
      }

      if (tile.id === 'ruins') {
        showRuinsEncounter(board, updateGameState, () => setEndTurn());
        return;
      }

      // Caravans and ambushes only ever meet a player on empty road.
      if (tile.id === 'road') {
        const finish = () => {
          consumeBattleWon();
          afterMoveLogic(board, updateGameState);
        };

        if (checkCaravanEncounter(board, updateGameState, finish)) return;
        if (checkAmbushEncounter(board, updateGameState, finish)) return;
        finish();
        return;
      }

      if (tile.isOwned() && tile.owner === player.id) {
        handleVisitOwnTile(board, updateGameState);
        return;
      }

      afterMoveLogic(board, updateGameState);
    };

    // Knighthood is granted once the move has actually finished (token has
    // landed) but before the tile's own screen — most importantly the King's
    // Castle screen itself, on a turn that lands exactly there — so the
    // promotion always reads as "you arrived, and by the way you're a
    // Knight now" rather than interrupting the move mid-animation.
    if (checkKnightPromotion(board, updateGameState, continueTileLogic, willCrossStart)) return;
    continueTileLogic();
  };

  // Check random encounters after roll, before movement starts.
  // Phase resets to before-move so encounter screens don't show rolling UI.
  gameEvent('setPhase', 'before-move');
  const continueFn = () => { proceedWithMove().catch(console.error); };

  // Cheat: a forced encounter fires this once, bypassing the usual odds, then
  // clears the flag. If it can't actually trigger (e.g. a rogue attack with no
  // owned tile to raid) we fall through to the normal random checks below.
  const forced = board.forcedEncounter;
  board.forcedEncounter = undefined;
  if (forced === 'dragon') {
    if (checkDragonEncounter(board, updateGameState, continueFn, true)) return;
  } else if (forced === 'caravan-gold') {
    if (checkCaravanEncounter(board, updateGameState, continueFn, 'gold')) return;
  } else if (forced === 'caravan-slaves') {
    if (checkCaravanEncounter(board, updateGameState, continueFn, 'slaves')) return;
  } else if (forced === 'caravan-horses') {
    if (checkCaravanEncounter(board, updateGameState, continueFn, 'horses')) return;
  } else if (forced === 'rogue') {
    if (checkRogueAttackEncounter(board, updateGameState, continueFn, true)) return;
  } else if (forced === 'workers') {
    if (checkWorkersEncounter(board, updateGameState, continueFn, true)) return;
  } else if (forced === 'joker') {
    if (checkJokerEncounter(board, updateGameState, continueFn, true)) return;
  }

  if (checkDragonEncounter(board, updateGameState, continueFn)) return;
  if (checkRogueAttackEncounter(board, updateGameState, continueFn)) return;
  if (checkWorkersEncounter(board, updateGameState, continueFn)) return;
  if (checkJokerEncounter(board, updateGameState, continueFn)) return;

  await proceedWithMove();
}
