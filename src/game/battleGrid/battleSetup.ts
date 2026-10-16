import { Player } from '../Player';
import { CaravanPrize } from '../caravanPrize';
import { Tile } from '../Tile';
import { DRAGON_UNITS } from '../constants';
import { getArtifactRollBonus } from '../artifacts';
import { ABSORB_PER_ROLL_POINT } from '../constants';
import { isLocalHuman } from '../seats';
import { getSettings } from '../../utils/settingsStore';
import { sizeArmyForGrid } from './scale';

type SizedArmy = ReturnType<typeof sizeArmyForGrid>;
import { battleBoardFor, squadGroupCount, BattleBoard } from './layout';
import { FormationSpec } from './formations';
import { createBattle } from './engine';
import { GridBattleState } from './types';
import type { BattleScreenProps } from '../../components/screens/BattleScreen';

export interface BattleSetup {
  isCaravan: boolean;
  isDragon: boolean;
  isPlayerBattle: boolean;
  isAmbush: boolean;
  isRogue: boolean;
  isTile: boolean;
  isDragonFight: boolean;
  statOverrides: Extract<BattleScreenProps, { mode: 'player' }>['statOverrides'];
  defence: number;
  defender: Player | undefined;
  tile: Tile | undefined;
  caravanPrize: CaravanPrize | undefined;
  battlefieldUnits: number | undefined;
  ambushAttackerUnits: number | undefined;
  /** Mounted share of the NPC force -- part of the total above, not extra. */
  caravanDefenceRiders: number;
  ambushAttackerRiders: number;
  isZombieAmbush: boolean;
  /** Ambush or a claim fought directly against an abandoned tile's wild
   * garrison -- decides the zombie-themed background/portrait. Frozen here
   * rather than re-read from `tile.abandoned` at render time, since a won
   * claim clears that flag (grantTile) the instant the fight resolves and
   * would otherwise flip the results screen's portrait back to the Saracen. */
  isZombieFlavored: boolean;
  isRuins: boolean;
  attackerSized: SizedArmy;
  defenderSized: SizedArmy;
  attackerGridTotal: number;
  defenderGridTotal: number;
  board: BattleBoard;
  attackerFormation: FormationSpec;
  defenderFormation: FormationSpec | undefined;
  garrisonAbsorbBonus: number;
  attackerRollBonus: number;
  defenderRollBonus: number;
  attackerManual: boolean;
  defenderManual: boolean;
}

/**
 * Everything about a battle that's decided purely from its mode and props --
 * army composition, board tier, formations, roll bonuses -- with no React or
 * rendering involved. BattleScreen freezes one of these in a ref for the
 * fight's lifetime; the headless economy simulator (src/game/economy) builds
 * one directly and runs the grid battle to completion with it. Shared so
 * the two can never decide a fight differently, the drift that had to be
 * repaired in the earlier battle simulator.
 */
export function buildBattleSetup(props: BattleScreenProps): BattleSetup {
  const { attacker } = props;

  const isCaravan = props.mode === 'caravan';
  const isDragon = props.mode === 'dragon';
  const isPlayerBattle = props.mode === 'player';
  const isAmbush = props.mode === 'ambush';
  const isRogue = props.mode === 'rogue';
  const isTile = !isCaravan && !isDragon && !isPlayerBattle && !isAmbush && !isRogue;
  const statOverrides = props.mode === 'player' ? props.statOverrides : undefined;

  let defence: number;
  let defender: Player | undefined;
  let tile: Tile | undefined;
  let caravanPrize: CaravanPrize | undefined;
  let battlefieldUnits: number | undefined;
  let ambushAttackerUnits: number | undefined;
  let caravanDefenceRiders = 0;
  let ambushAttackerRiders = 0;
  let isZombieAmbush = false;
  let isRuins = false;

  if (props.mode === 'caravan') {
    defence = props.caravanDefence;
    caravanDefenceRiders = Math.min(props.caravanDefenceRiders ?? 0, defence);
    caravanPrize = props.caravanPrize;
  } else if (props.mode === 'dragon') {
    defence = DRAGON_UNITS;
  } else if (props.mode === 'player') {
    defence = props.battlefieldUnits;
    defender = props.defender;
    battlefieldUnits = props.battlefieldUnits;
  } else if (props.mode === 'ambush') {
    defence = props.ambushAttackerUnits;
    ambushAttackerUnits = props.ambushAttackerUnits;
    ambushAttackerRiders = Math.min(props.ambushAttackerRiders ?? 0, ambushAttackerUnits);
    isZombieAmbush = !!props.isZombieAmbush;
    isRuins = !!props.isRuins;
  } else {
    defence = props.tile?.defence ?? 1;
    defender = props.defender;
    tile = props.tile;
  }

  const attackerCompRaw = isAmbush
    ? { militia: ambushAttackerUnits! - ambushAttackerRiders, riders: ambushAttackerRiders }
    : { militia: attacker.militia, riders: attacker.riders };
  const defenderCompRaw = (isTile || isRogue) && defender
    ? { militia: tile!.garrisonMilitia, riders: tile!.garrisonRiders }
    : isPlayerBattle
      ? { militia: defender!.militia, riders: defender!.riders }
      : isDragon
        ? { militia: 0, riders: DRAGON_UNITS }
        : isAmbush
          ? { militia: attacker.militia, riders: attacker.riders }
          // Caravan: its mounted guards are part of the same total headcount.
          : { militia: defence - caravanDefenceRiders, riders: caravanDefenceRiders };

  const attackerSized = sizeArmyForGrid(attackerCompRaw.militia, attackerCompRaw.riders);
  const defenderSized = sizeArmyForGrid(defenderCompRaw.militia, defenderCompRaw.riders);
  const attackerGridTotal = attackerSized.militiaCount + attackerSized.ridersCount;
  const defenderGridTotal = defenderSized.militiaCount + defenderSized.ridersCount;

  const isZombieFlavored = isZombieAmbush || (isTile && !!tile?.abandoned);

  const isDragonFight = isDragon || statOverrides?.defenderKind === 'dragon';
  const board = battleBoardFor(attackerGridTotal, defenderGridTotal, {
    allowBrawl: isTile || isRogue || isPlayerBattle || isCaravan || isAmbush,
    allowSmall: isTile || isRogue || isPlayerBattle,
    isDragon: isDragonFight,
  });
  const { isBrawl } = board;

  // isLocalHuman, not !isComputer: in an online game the defender is usually
  // someone else's seat, and a brawl asks its manual side for placement every
  // round -- input that player is not present to give. Their side is planned by
  // the AI instead (the same path a bot's is). Offline isLocalHuman(p) is
  // exactly !p.isComputer, so this is unchanged for a local game.
  // "Always use auto battle" (Settings screen) suppresses manual input for
  // the whole fight -- a local human is treated like a bot here too.
  const autoBattle = getSettings().autoBattle;
  const attackerManual = isBrawl && !isAmbush && isLocalHuman(attacker) && !autoBattle;
  const defenderManual =
    isBrawl && (isAmbush ? isLocalHuman(attacker) : !!defender && isLocalHuman(defender)) && !autoBattle;

  const squadCountFor = (player: Player): number => squadGroupCount(player.militia, player.riders);

  // The dragon fight is an encirclement: the player's army huddles at the
  // centre of the board with its tiers mixed, ringed by the dragons (see
  // formations.ts). Every other fight still lines the two sides up facing
  // each other across the board.
  const attackerFormation: FormationSpec = isDragonFight
    ? { kind: 'huddle' }
    : isBrawl
      ? { kind: 'compact' }
      : isAmbush
        ? { kind: 'triangle' }
        : { kind: 'grouped', groupCount: squadCountFor(attacker) };

  const defenderFormation: FormationSpec | undefined = isBrawl
    ? { kind: 'compact' }
    : isCaravan
      ? { kind: 'columns' }
      : isDragonFight
        ? { kind: 'encircle' }
        : isPlayerBattle
          ? { kind: 'grouped', groupCount: squadCountFor(defender!) }
          : isAmbush
            ? { kind: 'grouped', groupCount: squadCountFor(attacker) }
            : (isTile || isRogue) && tile
              ? { kind: 'grouped', groupCount: Math.max(1, tile.level) }
              : undefined;

  // The level-based fortification bonus is earned by an actual garrison
  // defending its owner's land -- a wild/unclaimed tile's default guards
  // (claimTile.ts, no defender) get none of it. The simulator's own defence
  // knob is a percentage, converted at the boundary since each point of the
  // absorption roll is worth 10%.
  const garrisonAbsorbBonus = (isTile || isRogue) && tile && tile.isOwned()
    ? tile.getGarrisonAbsorbBonus(tile.level)
    : Math.round((statOverrides?.defenderPctBonus ?? 0) / ABSORB_PER_ROLL_POINT);

  const attackerArtifactBonus = getArtifactRollBonus(attacker, { isDragon: isDragonFight });
  const defenderArtifactBonus =
    defender && !isTile && !isRogue ? getArtifactRollBonus(defender, { isDragon: isDragonFight }) : 0;
  const attackerRollBonus = isAmbush ? 0 : attackerArtifactBonus;
  const defenderRollBonus = isAmbush ? attackerArtifactBonus : defenderArtifactBonus;

  return {
    isCaravan,
    isDragon,
    isPlayerBattle,
    isAmbush,
    isRogue,
    isTile,
    isDragonFight,
    statOverrides,
    defence,
    defender,
    tile,
    caravanPrize,
    battlefieldUnits,
    ambushAttackerUnits,
    caravanDefenceRiders,
    ambushAttackerRiders,
    isZombieAmbush,
    isZombieFlavored,
    isRuins,
    attackerSized,
    defenderSized,
    attackerGridTotal,
    defenderGridTotal,
    board,
    attackerFormation,
    defenderFormation,
    garrisonAbsorbBonus,
    attackerRollBonus,
    defenderRollBonus,
    attackerManual,
    defenderManual,
  };
}

/**
 * The initial grid state for a battle already described by a BattleSetup --
 * shared by BattleScreen (which then plays it out turn by turn) and the
 * headless runner (which runs it straight to completion).
 */
export function buildInitialBattleState(setup: BattleSetup): GridBattleState {
  const { attackerSized, defenderSized, attackerFormation, defenderFormation, isZombieAmbush, isDragonFight, tile, statOverrides, board } = setup;

  return createBattle(
    {
      militia: attackerSized.militiaCount,
      riders: attackerSized.ridersCount,
      formation: attackerFormation,
      zombie: isZombieAmbush,
      ...(statOverrides
        ? {
            militiaHp: statOverrides.attackerMilitiaHp,
            militiaDmgMin: statOverrides.attackerMilitiaDmgMin,
            militiaDmgMax: statOverrides.attackerMilitiaDmgMax,
            riderHp: statOverrides.attackerRiderHp,
            riderDmgMin: statOverrides.attackerRiderDmgMin,
            riderDmgMax: statOverrides.attackerRiderDmgMax,
          }
        : {}),
    },
    {
      militia: defenderSized.militiaCount,
      riders: defenderSized.ridersCount,
      formation: defenderFormation,
      // Kept as its own kind (HP/damage/🐉) even though it now lines up in
      // a normal grouped formation rather than the dragon silhouette.
      dragon: isDragonFight,
      zombie: statOverrides ? statOverrides.defenderKind === 'zombie' : !!tile?.abandoned,
      // A 'normal' test defender shares the attacker's own militia stats,
      // same as simulate.ts — its own hp/dmg inputs are ignored.
      ...(statOverrides
        ? statOverrides.defenderKind === 'normal'
          ? {
              militiaHp: statOverrides.attackerMilitiaHp,
              militiaDmgMin: statOverrides.attackerMilitiaDmgMin,
              militiaDmgMax: statOverrides.attackerMilitiaDmgMax,
            }
          : {
              militiaHp: statOverrides.defenderHp,
              militiaDmgMin: statOverrides.defenderDmgMin,
              militiaDmgMax: statOverrides.defenderDmgMax,
              riderHp: statOverrides.defenderHp,
              riderDmgMin: statOverrides.defenderDmgMin,
              riderDmgMax: statOverrides.defenderDmgMax,
            }
        : {}),
    },
    board.cols,
    board.rows
  );
}
