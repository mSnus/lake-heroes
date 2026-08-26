import { Player } from '../Player';
import { Tile } from '../Tile';
import { DRAGON_UNITS } from '../constants';
import { getArtifactRollBonus } from '../artifacts';
import { sizeArmyForGrid } from './scale';

type SizedArmy = ReturnType<typeof sizeArmyForGrid>;
import { battleBoardFor, squadGroupCount, BattleBoard } from './layout';
import { FormationSpec } from './formations';
import { createBattle } from './engine';
import { GridBattleState } from './types';
import type { BattleScreenProps } from '../../components/BattleScreen';

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
  caravanPrize: number | undefined;
  caravanSlaves: boolean;
  battlefieldUnits: number | undefined;
  ambushAttackerUnits: number | undefined;
  /** Mounted share of the NPC force -- part of the total above, not extra. */
  caravanDefenceRiders: number;
  ambushAttackerRiders: number;
  isZombieAmbush: boolean;
  isRuins: boolean;
  attackerSized: SizedArmy;
  defenderSized: SizedArmy;
  attackerGridTotal: number;
  defenderGridTotal: number;
  board: BattleBoard;
  attackerFormation: FormationSpec;
  defenderFormation: FormationSpec | undefined;
  garrisonRollBonusPct: number;
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
  let caravanPrize: number | undefined;
  let caravanSlaves = false;
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
    caravanSlaves = props.caravanSlaves ?? false;
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

  const isDragonFight = isDragon || statOverrides?.defenderKind === 'dragon';
  const board = battleBoardFor(attackerGridTotal, defenderGridTotal, {
    allowBrawl: isTile || isRogue || isPlayerBattle || isCaravan || isAmbush,
    allowSmall: isTile || isRogue || isPlayerBattle,
  });
  const { isBrawl } = board;

  const attackerManual = isBrawl && !isAmbush && !attacker.isComputer;
  const defenderManual = isBrawl && (isAmbush ? !attacker.isComputer : !!defender && !defender.isComputer);

  const squadCountFor = (player: Player): number => squadGroupCount(player.militia, player.riders);

  const attackerFormation: FormationSpec = isBrawl
    ? { kind: 'compact' }
    : isAmbush
      ? { kind: 'triangle' }
      : { kind: 'grouped', groupCount: squadCountFor(attacker) };

  const defenderFormation: FormationSpec | undefined = isBrawl
    ? { kind: 'compact' }
    : isCaravan
      ? { kind: 'columns' }
      : isDragonFight
        ? { kind: 'grouped', groupCount: squadGroupCount(0, defenderGridTotal) }
        : isPlayerBattle
          ? { kind: 'grouped', groupCount: squadCountFor(defender!) }
          : isAmbush
            ? { kind: 'grouped', groupCount: squadCountFor(attacker) }
            : (isTile || isRogue) && tile
              ? { kind: 'grouped', groupCount: Math.max(1, tile.level) }
              : undefined;

  // The level-based fortification bonus is earned by an actual garrison
  // defending its owner's land -- a wild/unclaimed tile's default guards
  // (claimTile.ts, no defender) get none of it.
  const garrisonRollBonusPct = (isTile || isRogue) && tile && tile.isOwned()
    ? tile.getGarrisonBonusPct(tile.level)
    : (statOverrides?.defenderPctBonus ?? 0);

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
    caravanSlaves,
    battlefieldUnits,
    ambushAttackerUnits,
    caravanDefenceRiders,
    ambushAttackerRiders,
    isZombieAmbush,
    isRuins,
    attackerSized,
    defenderSized,
    attackerGridTotal,
    defenderGridTotal,
    board,
    attackerFormation,
    defenderFormation,
    garrisonRollBonusPct,
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
