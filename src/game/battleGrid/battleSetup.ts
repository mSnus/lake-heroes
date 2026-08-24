import { Player } from '../Player';
import { Tile } from '../Tile';
import { DRAGON_UNITS } from '../constants';
import { getArtifactRollBonus } from '../artifacts';
import { sizeArmyForGrid } from './scale';

type SizedArmy = ReturnType<typeof sizeArmyForGrid>;
import { battleBoardFor, squadGroupCount, BattleBoard } from './layout';
import { FormationSpec } from './formations';
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
  let isZombieAmbush = false;
  let isRuins = false;

  if (props.mode === 'caravan') {
    defence = props.caravanDefence;
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
    isZombieAmbush = !!props.isZombieAmbush;
    isRuins = !!props.isRuins;
  } else {
    defence = props.tile?.defence ?? 1;
    defender = props.defender;
    tile = props.tile;
  }

  const attackerCompRaw = isAmbush
    ? { militia: ambushAttackerUnits!, riders: 0 }
    : { militia: attacker.militia, riders: attacker.riders };
  const defenderCompRaw = (isTile || isRogue) && defender
    ? { militia: tile!.garrisonMilitia, riders: tile!.garrisonRiders }
    : isPlayerBattle
      ? { militia: defender!.militia, riders: defender!.riders }
      : isDragon
        ? { militia: 0, riders: DRAGON_UNITS }
        : isAmbush
          ? { militia: attacker.militia, riders: attacker.riders }
          : { militia: defence, riders: 0 };

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

  const garrisonRollBonusPct = (isTile || isRogue) && tile
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
