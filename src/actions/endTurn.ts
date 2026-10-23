import { GameState } from '../game/GameState';
import { isLocallyDriven } from '../game/seats';
import { recordTurnStat } from '../game/statistics';
import { resetForkChoice } from '../utils/forkChoiceStore';
import { beginTurn } from './beginTurn';
import { pushTurn } from '../online/sync';
import { closeStream } from '../online/stream';

export function endTurn(board: GameState | null, updateGameState: (board: GameState) => void) {
  if (!board) return;

  console.log('Action: end turn for', board.activePlayer.name);

  // Snapshot the outgoing player's stats -- but only if they actually took a
  // real turn. board.skippingTurn still reflects the PREVIOUS call's outcome
  // here (it's only cleared once a player falls through without skipping,
  // below), so it correctly identifies a player whose "turn" was just a
  // prison/skip tick with no real move -- recording that would duplicate the
  // turn number of whoever played before them.
  if (!board.skippingTurn && !board.harvest) {
    recordTurnStat(board, board.activePlayer);
  }

  board.activePlayerIndex = (board.activePlayerIndex + 1) % board.players.length;
  // Deliberately NOT cleared here. rollAndMove already blanks it when the next
  // player actually rolls, so clearing it now only wiped the description of the
  // turn that just happened -- which online is the very thing the other players
  // are handed, and their only account of what we did.
  // Safety net alongside rollAndMove's own reset -- covers a turn that ends
  // without ever rolling (e.g. a skipped prison turn), so a choice made on a
  // prior visit to the fork can never leak into a later one.
  resetForkChoice();

  board.turnStarted = false;

  // Stop narrating before the state goes out, so a last line cannot race the
  // push. Anything unsent travels in the envelope's _log instead.
  closeStream();

  // Offline (and for a seat this browser owns) the next turn starts right here,
  // making endTurn+beginTurn exactly the single function this used to be. When
  // the next seat belongs to someone else, we stop at the boundary and hand the
  // state over instead -- they run beginTurn when they receive it.
  if (isLocallyDriven(board.activePlayer, board)) {
    beginTurn(board, updateGameState);
    // Still published, even though nobody else has to act: the other players
    // watch the board through these pushes, and without one a hot-seat bundle
    // or a run of host-driven bots stays invisible until a turn finally leaves
    // this browser. A no-op offline.
    void pushTurn(board);
    return;
  }

  // The next seat is someone else's. Show the handed-over board locally, then
  // upload it -- deliberately not awaited: the turn is already complete here,
  // and pushTurn surfaces its own failure through the online store rather than
  // leaving an unhandled rejection in a click handler.
  updateGameState(board);
  void pushTurn(board);
}
