import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { changeFame } from '../../utils/fame';
import { BattleResolution, BattleOutcome, logBattleSummary } from './common';
import { resolveKingsContractOnClaim } from '../../game/kingsContracts';
import { recordStatEvent } from '../../game/statistics';
import { setGameMessage } from '../../utils/gameMessage';
import { t } from '../../i18n';

/**
 * Resolve a battle for a tile.
 * - Win on an unowned tile = CLAIM: attacker loses killed units, pays the
 *   level-1 gold price (units are already spent in the fight), and gains
 *   ownership. New owner's garrison starts empty — they must station troops.
 * - Win on an owned tile = RAZE: attacker loses killed units, ownership
 *   cleared, level reset, garrison restored to the tile's authored baseline
 *   (see wildGarrison.ts, which keeps growing it further the longer it sits
 *   unclaimed) — and the tile goes "on fire" (unbuyable) for the rest of
 *   this round.
 * - Defeat: attacker loses killed units. On an owned tile, the owner's real
 *   garrison takes real losses too (defenderUnitsKilled); on an unowned
 *   (wild-guarded) tile, the guard count is untouched -- they aren't a real
 *   player's army to whittle down.
 * - Tie: no fee; tile drops a level (if above 1); an owned tile's garrison
 *   still takes the losses it suffered defending (wild guards, again,
 *   don't).
 *
 * `defenderUnitsKilled` is already a real militia/riders headcount by the
 * time it reaches here — the grid battle's raw cell losses are rescaled
 * back to real units in BattleScreen (see game/battleGrid/scale.ts) before
 * this resolver is called, so no further rescaling happens here.
 */
export function resolveTileBattle(
  board: GameState,
  attacker: Player,
  defender: Player | undefined,
  tile: Tile,
  attackerUnitsKilled: number,
  defenderUnitsKilled: number,
  outcome: BattleOutcome
): BattleResolution {
  const unitsBefore = attacker.units;
  const goldBefore = attacker.gold;
  const claiming = !tile.isOwned();

  // A tie leaves the tile owned by the same opponent, same as before the
  // fight -- without this, a reload right after a tied battle would
  // re-derive and re-show the same encounter screen from scratch (see
  // Player.hasResolvedTileEncounterThisTurn).
  attacker.hasResolvedTileEncounterThisTurn = true;

  let message = '';
  let victoryBg = false;
  let lostBg = false;

  if (outcome === 'attacker') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    const lossStr = attackerUnitsKilled > 0 ? t('resolveTileBattle.losingSuffix', { units: attackerUnitsKilled }) : '';

    if (claiming) {
      attacker.gold -= tile.prices['1']?.gold ?? 0;
      tile.owner = attacker.id;
      tile.garrison = 0;
      tile.unclaimedSinceTurn = undefined;
      tile.abandoned = false;
      attacker.ownedTiles.push(attacker.position);
      changeFame(attacker, 1);

      message = t('resolveTileBattle.claims', { attackerName: attacker.name, tileName: tile.name, lossStr });

      const contractResult = resolveKingsContractOnClaim(board, attacker.position, attacker);
      if (contractResult.fulfilled && contractResult.award) {
        attacker.gold += contractResult.award;
        message += ' ' + t('resolveTileBattle.contractFulfilled', { award: contractResult.award });
      }

      victoryBg = true;
    } else {
      board.players.forEach((p) => {
        p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
      });
      tile.owner = null;
      tile._level = 1;
      tile.isYielded = false;
      tile.garrison = tile.baseGarrison;
      tile.unclaimedSinceTurn = board.turns;
      tile.razedInRound = board.round;
      tile.abandoned = true;

      changeFame(attacker, 1);
      if (defender) changeFame(defender, -1);

      setGameMessage(board, t('resolveTileBattle.razedGameMessage', { attackerName: attacker.name, tileName: tile.name, lossStr }));
      message = t('resolveTileBattle.razes', { attackerName: attacker.name, tileName: tile.name, lossStr });
      victoryBg = true;
    }
  } else if (outcome === 'defender') {
    if (attackerUnitsKilled > 0) attacker.units = Math.max(0, attacker.units - attackerUnitsKilled);
    // Wild guards on an unowned tile aren't a real player's army — a failed
    // claim leaves their numbers untouched. Only a real owner's garrison
    // takes real losses.
    if (!claiming) tile.garrison = Math.max(0, tile.garrison - defenderUnitsKilled);
    const lossStr = attackerUnitsKilled > 0 ? t('resolveTileBattle.losingSuffix', { units: attackerUnitsKilled }) : '';

    setGameMessage(board, t('resolveTileBattle.lostBattleGameMessage', { attackerName: attacker.name, tileName: tile.name, lossStr }));
    message = t('resolveTileBattle.retreats', { attackerName: attacker.name, tileName: tile.name, lossStr });
    lostBg = true;
  } else {
    // A tie on a garrisoned (owned) tile costs the attacker exactly what the
    // battle itself cost them (not the flat defence/4 formula below) and
    // wipes the garrison out entirely, rather than only partially thinning
    // it -- ownership stays with the defender either way. Wild guards on an
    // unowned tile aren't a real player's army, so a tied claim attempt
    // keeps the old flat-formula loss and leaves their numbers untouched.
    const unitLoss = claiming ? Math.floor(tile.defence / 4) : attackerUnitsKilled;
    if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
    if (!claiming) tile.garrison = 0;
    const lossStr = unitLoss > 0 ? t('resolveTileBattle.losingSuffix', { units: unitLoss }) : '';
    if (tile.level > 1) {
      tile._level = tile.level - 1;
      setGameMessage(
        board,
        t('resolveTileBattle.degradedGameMessage', {
          attackerName: attacker.name,
          tileName: tile.name,
          level: tile.level,
          lossStr,
        })
      );
      message = t('resolveTileBattle.degradedMessage', { tileName: tile.name, lossStr });
    } else {
      setGameMessage(board, t('resolveTileBattle.stalemateGameMessage', { attackerName: attacker.name, tileName: tile.name, lossStr }));
      message = t('resolveTileBattle.armyRetreats', { attackerName: attacker.name, lossStr });
    }
  }

  const opponentName = defender ? defender.name : t('resolveTileBattle.theGuards');

  if (outcome === 'attacker' || outcome === 'defender') {
    recordStatEvent(board, attacker, outcome === 'attacker' ? 'battle-won' : 'battle-lost', opponentName);
  }

  logBattleSummary(attacker, opponentName, outcome, outcome === 'attacker' ? tile.name : null, unitsBefore, goldBefore, claiming);

  return { outcome, message, victoryBg, lostBg };
}
