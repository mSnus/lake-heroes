import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { handleTreasureBox } from './treasureBox';
import { handleTavern } from './tavern';
import { handlePrison } from './prison';
import { handleSphynx } from './sphynx';
import { handleKingCastle } from './king';
import { handleJoker } from './joker';
import { handlePortal } from './portal';
import { handleVisitOwnTile } from './visitOwnTile';
import { passStart } from './passStart';
import { afterMoveLogic } from './afterMoveLogic';
import { revealTile } from './revealTile';
import { say } from '../utils/say';
import { TILE_COUNT } from '../game/constants';
import { gameEvent } from '../utils/events';
import { showTreasureScreen, showTavernScreen, showSphynxScreen } from '../utils/screenStore';
import { checkDragonEncounter } from './dragonEncounter';
import { checkCaravanEncounter } from './caravanEncounter';
import { checkAmbushEncounter } from './ambushEncounter';
import { checkRogueAttackEncounter } from './rogueAttackEncounter';
import { checkKnightPromotion } from './knightPromotion';
import { tickWildGarrisons } from '../game/wildGarrison';
import { t } from '../i18n';

export async function rollAndMove(
  board: GameState | null,
  updateGameState: (board: GameState) => void,
  preRolledValue?: number
) {
    if (!board) return;

  // Use the value already rolled by the dice widget (avoids re-triggering the animation)
  const roll = preRolledValue !== undefined ? preRolledValue : rollDice();
  const player = board.activePlayer;

  const willCrossStart = player.position + roll >= TILE_COUNT;
  const nextTileIdx = (player.position + roll) % TILE_COUNT;
  const nextTile = board.tiles[nextTileIdx];

  gameEvent('setPhase', 'rolling');

  board.gameMessage = '';

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

  gameEvent('displayTile', {});

  const proceedWithMove = async () => {
    // Step-by-step move with 0.2s delay per tile
    for (let step = 1; step <= roll; step++) {
      const nextPos = (player.position + 1) % TILE_COUNT;
      const willWrap = player.position + 1 >= TILE_COUNT;

      gameEvent('setPhase', 'moving');
      player.position = nextPos;
      updateGameState(board);

      if (willWrap) {
        passStart(board, updateGameState);
      }

      await new Promise((res) => setTimeout(res, 300));
    }

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
    gameEvent('displayTile', board.activeTile.isOwnable ? board.activeTile : {});

    updateGameState(board);

    const continueTileLogic = () => {
      const tile = board.activeTile;
      if (tile.id === 'treasure-chest') {
        showTreasureScreen(t('treasureBox.treasureFound'), (roll) =>
          handleTreasureBox(board, updateGameState, roll)
        );
        return;
      }

      if (tile.id === 'tavern') {
        showTavernScreen(tile.name, (roll) => handleTavern(board, updateGameState, roll));
        return;
      }

      if (tile.id === 'prison') {
        handlePrison(board, updateGameState);
        return;
      }

      if (tile.id === 'sphynx') {
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
  } else if (forced === 'rogue') {
    if (checkRogueAttackEncounter(board, updateGameState, continueFn, true)) return;
  }

  if (checkDragonEncounter(board, updateGameState, continueFn)) return;
  if (checkCaravanEncounter(board, updateGameState, continueFn)) return;
  if (checkAmbushEncounter(board, updateGameState, continueFn)) return;
  if (checkRogueAttackEncounter(board, updateGameState, continueFn)) return;

  await proceedWithMove();
}
