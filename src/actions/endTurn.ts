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
import { recordTurnStat } from '../game/statistics';
import { collectTileTurnIncome } from '../game/income';
import { recordSimIncome } from '../utils/simLogStore';
import { resetForkChoice } from '../utils/forkChoiceStore';
import { formatArmy } from '../utils/formatArmy';
import { announce } from '../utils/announce';
import { setGameMessage } from '../utils/gameMessage';
import { t } from '../i18n';

export function endTurn(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  console.log('Action: end turn for', board.activePlayer.name);

  // Snapshot the outgoing player's stats -- but only if they actually took a
  // real turn. board.skippingTurn still reflects the PREVIOUS call's outcome
  // here (it's only cleared once a player falls through without skipping,
  // below), so it correctly identifies a player whose "turn" was just a
  // prison/skip tick with no real move -- recording that would duplicate the
  // turn number of whoever played before them.
  if (!board.skippingTurn) {
    recordTurnStat(board, board.activePlayer);
  }

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  setGameMessage(board, '');
  // Safety net alongside rollAndMove's own reset -- covers a turn that ends
  // without ever rolling (e.g. a skipped prison turn), so a choice made on a
  // prior visit to the fork can never leak into a later one.
  resetForkChoice();
  board.activePlayer.hasClaimedThisTurn = false;
  board.activePlayer.hasConsideredClaimThisTurn = false;
  board.activePlayer.hasResolvedTileEncounterThisTurn = false;
  board.activePlayer.hasCheckedKingsContractThisTurn = false;
  board.activePlayer.upgradesThisTurn = 0;

  // Tiles pay their owner at the start of every turn now, not once a lap --
  // applies even to a player about to skip their turn in prison, since it's
  // their tiles earning it, not them personally taking an action.
  const turnIncome = collectTileTurnIncome(board, board.activePlayer);
  if (isHeadlessRun()) recordSimIncome(turnIncome.gold, turnIncome.units);
  if (turnIncome.gold > 0 || turnIncome.units > 0) {
    const incomeParts: string[] = [];
    if (turnIncome.gold > 0) incomeParts.push(`${turnIncome.gold}🟡`);
    if (turnIncome.units > 0) incomeParts.push(`${turnIncome.units}🧍`);
    say(
      t('endTurn.turnIncome', {
        playerName: board.activePlayer.name,
        summary: incomeParts.join(` ${t('common.and')} `),
      }),
      'debug'
    );
  }

  if (board.activePlayerIndex === 0) {
    board.round++;
    console.debug(`Round ${board.round}`, board.players);
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
      } else if (player.gold < 100) {
        changeFame(player, -1, player.isKnight ? KNIGHT_FAME : 1);
        setGameMessage(board, t('endTurn.prisonFameFine', { playerSpan }));
        say(t('endTurn.prisonFameFineToast', { playerName: player.name }), 'info');
      } else {
        const fine = Math.round(player.gold / 4 / 100) * 100;
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
