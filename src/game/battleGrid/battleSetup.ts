import { Player } from '../Player';
import { CaravanPrize } from '../caravanPrize';
import { Tile } from '../Tile';
import { DRAGON_UNITS } from '../constants';
import { getArtifactRollBonus } from '../artifacts';
import { ABSORB_PER_ROLL_POINT } from '../constants';
import { isLocalHuman } from '../seats';
import { sizeArmyForGrid } from './scale';
import { createBattle } from './engine';
import { BattleSide, GridBattleState } from './types';

type SizedArmy = ReturnType<typeof sizeArmyForGrid>;
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
  garrisonAbsorbBonus: number;
  attackerRollBonus: number;
  defenderRollBonus: number;
  /** Grid sides a local human may switch to manual control. */
  attackerManual: boolean;
  defenderManual: boolean;
  /** The grid side of the human who started the fight (or got ambushed) --
   * the only side offered an escape. */
  escapeSide: BattleSide | null;
}

/**
 * Everything about a battle that's decided purely from its mode and props --
 * army composition, manual-control and escape sides, roll bonuses -- with no React or
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

  // isLocalHuman, not !isComputer: in an online game the defender is usually
  // someone else's seat, and manual control asks its side for placement every
  // round -- input that player is not present to give. Offline isLocalHuman(p)
  // is exactly !p.isComputer.
  const attackerManual = !isAmbush && !isRogue && isLocalHuman(attacker);
  const defenderManual = isAmbush ? isLocalHuman(attacker) : !!defender && isLocalHuman(defender);
  // Rogue: the attacker is an NPC horde, and garrison defenders fight on.
  const escapeSide: BattleSide | null = isRogue || !isLocalHuman(attacker) ? null : isAmbush ? 'defender' : 'attacker';

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
    garrisonAbsorbBonus,
    attackerRollBonus,
    defenderRollBonus,
    attackerManual,
    defenderManual,
    escapeSide,
  };
}

/**
 * The initial grid state for a battle already described by a BattleSetup --
 * shared by BattleScreen (which then plays it out turn by turn) and the
 * headless runner (which runs it straight to completion).
 */
export function buildInitialBattleState(setup: BattleSetup): GridBattleState {
  const { attackerSized, defenderSized, isZombieAmbush, isDragonFight, tile, statOverrides } = setup;

  return createBattle(
    {
      militia: attackerSized.militiaCount,
      riders: attackerSized.ridersCount,
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
      // Kept as its own kind (HP/damage/🐉).
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
    }
  );
}
