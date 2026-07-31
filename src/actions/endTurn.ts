import { GameState } from '../game/GameState';
import { gameEvent } from '../utils/events';
import { say } from '../utils/say';
import { DRAGON_UNITS_THRESHOLD, offerDragonChallenge } from './fightDragon';
import { setEndTurn } from '../utils/endTurnStore';
import { releasePrisonerOfWar } from './releasePrisonerOfWar';
import { hasArtifact, getArtifact } from '../game/artifacts';
import { changeFame, KNIGHT_FAME } from '../utils/fame';
import { recordTurnStat } from '../game/statistics';
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
  board.gameMessage = '';
  board.activePlayer.hasClaimedThisTurn = false;
  board.activePlayer.hasConsideredClaimThisTurn = false;
  board.activePlayer.upgradesThisTurn = 0;

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
      if (hasArtifact(player, 'medal-of-honor')) {
        const artifact = getArtifact('medal-of-honor');
        board.gameMessage = t('endTurn.prisonFineWaived', {
          playerSpan,
          artifactName: artifact!.name,
          emoji: artifact!.emoji,
        });
        say(t('endTurn.prisonFineWaivedToast', { playerName: player.name }), 'info');
      } else if (player.gold < 100) {
        changeFame(player, -1, player.isKnight ? KNIGHT_FAME : 1);
        board.gameMessage = t('endTurn.prisonFameFine', { playerSpan });
        say(t('endTurn.prisonFameFineToast', { playerName: player.name }), 'info');
      } else {
        const fine = Math.round(player.gold / 4 / 100) * 100;
        player.gold -= fine;
        board.gameMessage = t('endTurn.prisonGoldFine', { playerSpan, fine });
        say(t('endTurn.prisonGoldFineToast', { playerName: player.name, fine }), 'info');
      }
    } else {
      board.gameMessage = t('endTurn.prisonIsWetAndCold', { playerName: player.name });
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
        units: board.activePlayer.units,
      }),
      'info'
    );
    board.gameMessage = t('endTurn.dragonGuardsGold');
    updateGameState(board);
    offerDragonChallenge(board, updateGameState, () => gameEvent('showDice', null));
    return;
  }

  updateGameState(board);
  gameEvent('showDice', null);
}
