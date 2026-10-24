import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { DRAGON_UNITS_THRESHOLD, offerDragonChallenge, fightDragon } from './fightDragon';
import { isHeadlessRun } from '../utils/headlessStore';
import { shouldChallengeDragon } from '../ai/decisions';
import { setEndTurn } from '../utils/endTurnStore';
import { releasePrisonerOfWar } from './releasePrisonerOfWar';
import { getPrisonProtectionArtifact } from '../game/artifacts';
import { changeFame, KNIGHT_FAME } from '../utils/fame';
import { collectTileTurnIncome } from '../game/income';
import { endYear, startNewYear, yearForRound } from '../game/year';
import { beginHarvestTurn } from './harvest';
import { recordSimIncome } from '../utils/simLogStore';
import { formatArmy } from '../utils/formatArmy';
import { announce } from '../utils/announce';
import { setGameMessage } from '../utils/gameMessage';
import { openStream } from '../online/stream';
import { t } from '../i18n';

/**
 * Everything that belongs to the player whose turn is STARTING: their per-turn
 * flag resets, their tiles' income, the round bump, the prison tick, and the
 * dragon challenge offer.
 *
 * Split out of endTurn because endTurn advances activePlayerIndex first, so all
 * of this already operated on the *incoming* player. Offline that distinction
 * is invisible -- the same browser does both. Online it is the whole point:
 * this half has to run on the incoming player's own machine, or their dragon
 * prompt and dice would open in the previous player's browser.
 *
 * Idempotent via board.turnStarted, so applying the same synced state twice
 * cannot collect the income twice.
 */
export function beginTurn(board: GameState, updateGameState: (board: GameState) => void) {
  if (board.turnStarted) return;
  board.turnStarted = true;

  // From here until endTurn, this client's narration is streamed to the other
  // players (online/stream.ts decides whether it is actually ours to narrate).
  openStream(board);

  board.activePlayer.hasClaimedThisTurn = false;
  board.activePlayer.hasConsideredClaimThisTurn = false;
  board.activePlayer.hasResolvedTileEncounterThisTurn = false;
  board.activePlayer.hasCheckedKingsContractThisTurn = false;
  board.activePlayer.upgradesThisTurn = 0;
  board.activePlayer.garrisonSpentThisTurn = 0;
  board.activePlayer.owedToll = 0;
  board.activePlayer.hasSettledTollThisTurn = false;
  board.activePlayer.hasPillagedThisTurn = false;

  if (board.activePlayerIndex === 0) {
    // The last player's turn just ended, so this is also where the shared
    // calendar ticks over -- ahead of the prison-skip check below, which is
    // what makes a turn spent in jail still pass the time. The year's last
    // day is followed by a Harvest round, which is not a day itself.
    if (board.harvest) {
      board.harvest = false;
      board.round++;
      startNewYear(board);
    } else if (yearForRound(board.round + 1) > yearForRound(board.round)) {
      board.harvest = true;
      endYear(board);
    } else {
      board.round++;
    }

    console.debug(`Round ${board.round}`, board.players);
  }

  if (board.harvest) {
    beginHarvestTurn(board, updateGameState);
    return;
  }

  // Tiles pay their owner at the start of every turn now, not once a lap --
  // applies even to a player about to skip their turn in prison, since it's
  // their tiles earning it, not them personally taking an action.
  const turnIncome = collectTileTurnIncome(board, board.activePlayer);
  if (isHeadlessRun()) recordSimIncome(turnIncome.gold, turnIncome.units);
  if (turnIncome.gold > 0 || turnIncome.food > 0 || turnIncome.arms > 0 || turnIncome.units > 0) {
    const incomeParts: string[] = [];
    if (turnIncome.gold > 0) incomeParts.push(`${turnIncome.gold}🟡`);
    if (turnIncome.food > 0) incomeParts.push(`${turnIncome.food}🫓`);
    if (turnIncome.arms > 0) incomeParts.push(`${turnIncome.arms}⚔️`);
    if (turnIncome.units > 0) incomeParts.push(`${turnIncome.units}🧍`);
    say(
      t('endTurn.turnIncome', {
        playerName: board.activePlayer.name,
        summary: incomeParts.join(` ${t('common.and')} `),
      }),
      'debug'
    );
  }

  if (board.activePlayer.turnsToSkip > 0) {
    const player = board.activePlayer;
    player.turnsToSkip--;
    board.skippingTurn = true;

    // Released this tick (was their last skipped turn) -- pay a fine to quit
    // the prison, same as a real jailbreak. Doesn't apply to a Prisoner of
    // War's release, which already has its own separate ransom ritual right
    // after this block.
    if (player.turnsToSkip === 0 && !player.isPrisonerOfWar) {
      const playerSpan = `<span style="color:${player.color}">${player.name}</span>`;
      const prisonArtifact = getPrisonProtectionArtifact(player);
      if (prisonArtifact) {
        setGameMessage(
          board,
          t('endTurn.prisonFineWaived', {
            playerSpan,
            artifactName: prisonArtifact.name,
            emoji: prisonArtifact.emoji,
          })
        );
        say(t('endTurn.prisonFineWaivedToast', { playerName: player.name, artifactName: prisonArtifact.name }), 'info');
      } else if (player.gold < 10) {
        changeFame(player, -1, player.isKnight ? KNIGHT_FAME : 1);
        setGameMessage(board, t('endTurn.prisonFameFine', { playerSpan }));
        say(t('endTurn.prisonFameFineToast', { playerName: player.name }), 'info');
      } else {
        const fine = Math.round(player.gold / 4 / 10) * 10;
        player.gold -= fine;
        setGameMessage(board, t('endTurn.prisonGoldFine', { playerSpan, fine }));
        say(t('endTurn.prisonGoldFineToast', { playerName: player.name, fine }), 'info');
      }
    } else {
      setGameMessage(board, t('endTurn.prisonIsWetAndCold', { playerName: player.name }));
      say(t('endTurn.dwellsInPrison', { playerName: player.name }), 'info');
    }

    updateGameState(board);
    setEndTurn();
    return;
  }

  board.skippingTurn = false;

  // A prisoner of war who has served their skipped turn is ransomed by the King
  // before they roll to leave prison.
  if (board.activePlayer.isPrisonerOfWar) {
    releasePrisonerOfWar(board);
    updateGameState(board);
  }

  if (
    board.activePlayer.armyPower >= DRAGON_UNITS_THRESHOLD &&
    !board.activePlayer.hasBeenOfferedDragonChallenge
  ) {
    board.activePlayer.hasBeenOfferedDragonChallenge = true;
    say(
      t('endTurn.enoughToChallengeDragon', {
        playerName: board.activePlayer.name,
        army: formatArmy(board.activePlayer.militia, board.activePlayer.riders),
      }),
      'info'
    );
    setGameMessage(board, t('endTurn.dragonGuardsGold'));
    updateGameState(board);
    // Fight-or-flee is a real 2-way decision -- same call BotController
    // makes, and the same one checkDragonEncounter's headless branch uses.
    if (isHeadlessRun()) {
      if (shouldChallengeDragon(board.activePlayer)) {
        announce(board.activePlayer, 'botController.fightTheDragon');
        fightDragon(board, updateGameState);
      }

      return;
    }

    offerDragonChallenge(board, updateGameState, () => gameEvent('showDice', null));
    return;
  }

  updateGameState(board);
  gameEvent('showDice', null);
}
