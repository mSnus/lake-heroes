import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved, showScreen } from '../utils/screenStore';
import { getOverrides } from '../utils/overridesStore';
import { setEndTurn } from '../utils/endTurnStore';
import { say } from '../utils/say';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { PlayerCard } from './PlayerCard';
import { DecoratedButton } from './DecoratedButton';
import { BattlefieldGrid } from './BattlefieldGrid';
import { BattleOutcome, BattleResolution } from '../actions/battles/common';
import { resolveTileBattle } from '../actions/battles/resolveTileBattle';
import { resolveRogueAttack } from '../actions/battles/resolveRogueAttack';
import { resolveCaravanBattle } from '../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../actions/battles/resolveDragonBattle';
import { resolvePlayerBattle } from '../actions/battles/resolvePlayerBattle';
import { resolveAmbush, AmbushOutcome } from '../actions/battles/resolveAmbush';
import { resolveRuinsBattle } from '../actions/battles/resolveRuinsBattle';
import { useT } from '../i18n';
import { DRAGON_UNITS } from '../game/constants';
import { getArtifactRollBonus, getArtifactRollBonusBreakdown } from '../game/artifacts';
import { createBattle, stepTurn, isBattleOver, planBrawlSide, applyBrawlMoves, resolveBrawlCombat, BrawlPlan } from '../game/battleGrid/engine';
import { sizeArmyForGrid, realLossFromGridLoss } from '../game/battleGrid/scale';
import { battleBoardFor, squadGroupCount } from '../game/battleGrid/layout';
import { GridBattleState, TurnEvent, BattleSide } from '../game/battleGrid/types';
import { FormationSpec } from '../game/battleGrid/formations';
import { TileClaimScreen } from './TileClaimScreen';
import { showTileEncounterScreen } from '../actions/afterMoveLogic';
import '../styles/BattleScreen.css';

type BattlePhase = 'ongoing' | 'result';

// Pause between automatic turns when both sides are bots — fast, but still a
// visible turn-by-turn playback rather than an instant jump to the result.
const AUTO_TURN_DELAY_MS = 250;

// Duration of the per-turn combat animation (see handleNextTurn): weapons/
// shields (🗡️/🛡️) -> who's under attack (💥) -> each unit's own result
// (🩸 wounded, 🛡️ blocked, ☠️ died).
const COMBAT_ANIM_BEAT_MS = 125;
const IMPACT_FLASH_MS = 150;
// The result beat gets a slightly longer flash than the others to give more
// per-unit detail time to actually read.
const OUTCOME_FLASH_MS = 250;
// How long the brawl move phase animates (units slide to their new cells,
// CSS transition ~0.25s) before the combat resolution plays out.
const BRAWL_MOVE_ANIM_MS = 320;
// Brief hold after the player's placed units snap into position (twins hidden)
// before the fight resolves — long enough to read the new formation.
const BRAWL_SNAP_HOLD_MS = 260;

export type BattleScreenProps =
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode?: 'tile';
      defender?: Player;
      tile?: Tile;
      onClose?: never;
      statOverrides?: never;
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'caravan';
      caravanDefence: number;
      caravanPrize: number;
      caravanSlaves?: boolean;
      onClose: () => void;
      defender?: never;
      tile?: never;
      statOverrides?: never;
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'dragon';
      defender?: never;
      tile?: never;
      onClose?: never;
      statOverrides?: never;
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'player';
      defender: Player;
      battlefieldUnits: number;
      onClose: () => void;
      tile?: never;
      caravanDefence?: never;
      caravanPrize?: never;
      caravanSlaves?: never;
      /** Set only by the battle simulator's "Run battle" button — fights this
       * one-off test battle with custom hp/dmg instead of the live
       * overridesStore values (see BattleSimScreen.tsx). */
      statOverrides?: {
        attackerMilitiaHp: number;
        attackerMilitiaDmgMin: number;
        attackerMilitiaDmgMax: number;
        attackerRiderHp: number;
        attackerRiderDmgMin: number;
        attackerRiderDmgMax: number;
        defenderKind: 'normal' | 'zombie' | 'dragon';
        defenderHp: number;
        defenderDmgMin: number;
        defenderDmgMax: number;
        defenderPctBonus: number;
      };
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'ambush';
      ambushAttackerUnits: number;
      /** True when the ambushers are an abandoned tile's zombie garrison
       * rather than regular NPC ambushers (see zombieAmbushEncounter.tsx) —
       * reskins the attacker-role grid units, field icon, and label. */
      isZombieAmbush?: boolean;
      /** True for the Ruins tile's fixed monster encounter (see
       * ruinsEncounter.ts) — reuses the same reversed-role ambush shape, but
       * with its own opening message, background, and outcome resolution
       * (resolveRuinsBattle instead of resolveAmbush). Always paired with
       * isZombieAmbush for the zombie reskin. */
      isRuins?: boolean;
      onClose: () => void;
      defender?: never;
      tile?: never;
      caravanDefence?: never;
      caravanPrize?: never;
      caravanSlaves?: never;
      battlefieldUnits?: never;
      statOverrides?: never;
    }
  | {
      // `attacker` is a synthetic NPC "horde" Player (see
      // rogueAttackEncounter.ts) — none of its own gold/units/fame ever
      // matter, it just needs to always auto-roll. `defender` is the real
      // tile owner, whose garrison (not personal army) is what's actually
      // defending.
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'rogue';
      defender: Player;
      tile: Tile;
      onClose: () => void;
      caravanDefence?: never;
      caravanPrize?: never;
      caravanSlaves?: never;
      battlefieldUnits?: never;
      ambushAttackerUnits?: never;
      statOverrides?: never;
    };

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const t = useT();
  const { attacker, gameState, updateGameState } = props;

  // ── Mode extraction (TypeScript narrowing per branch) ──
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

  // `defence`/`attacker` army composition are read live from props/Player
  // fields, which is fine while the fight is in progress — but resolving the
  // battle mutates the underlying tile/player, and this component stays
  // mounted showing the result afterward. Snapshot once so the grid the
  // player watched fighting keeps matching the "X vs Y" readout and the
  // eventual casualty translation, rather than reflecting what's left after
  // the fight already happened.
  const defenceRef = useRef(defence);
  const initialDefence = defenceRef.current;

  // ── Grid army composition per mode (militia/riders), then capped to fit
  // the battlefield via sizeArmyForGrid — mirrors the old attacker/defender
  // tier-count derivation, now producing real grid units instead of a duel
  // headcount/rider-multiplier split. ──
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
          // Ambush is reversed: `attacker` holds the real player, who occupies
          // the DEFENDER grid role — so their real army composition (not the
          // NPC ambusher headcount) belongs here, riders included.
          ? { militia: attacker.militia, riders: attacker.riders }
          : { militia: initialDefence, riders: 0 };

  const attackerSizedRef = useRef(sizeArmyForGrid(attackerCompRaw.militia, attackerCompRaw.riders));
  const defenderSizedRef = useRef(sizeArmyForGrid(defenderCompRaw.militia, defenderCompRaw.riders));
  const attackerSized = attackerSizedRef.current;
  const defenderSized = defenderSizedRef.current;
  const attackerGridTotal = attackerSized.militiaCount + attackerSized.ridersCount;
  const defenderGridTotal = defenderSized.militiaCount + defenderSized.ridersCount;
  // Board tier -- shared with the battle simulator via battleBoardFor (see
  // layout.ts), so a simulated fight always lands on the same board a real
  // one would. Brawl (both sides at or below BRAWL_THRESHOLD: a compact,
  // larger-celled board with turn-based / manual control) covers every mode
  // except dragon; ambush is included, its reversed attacker/defender roles
  // being handled by attackerManual/defenderManual below. The small-board
  // tier is scoped tighter -- ambush's triangle wedge needs far more height
  // than a 'grouped' formation at the same headcount, so it stays off it.
  const isDragonFight = isDragon || statOverrides?.defenderKind === 'dragon';
  const board = battleBoardFor(attackerGridTotal, defenderGridTotal, {
    allowBrawl: isTile || isRogue || isPlayerBattle || isCaravan || isAmbush,
    allowSmall: isTile || isRogue || isPlayerBattle,
  });
  const { isBrawl, isLargeAutoBattle, cols: gridCols, rows: gridRows } = board;
  // A side is manually controlled whenever its player is a real human, not
  // just whoever's turn it currently is -- so if a human attacks another
  // human's tile/hero, that other player also gets to place their own
  // defence instead of it auto-planning for them. In ambush, `attacker`
  // holds the real player but their army occupies the grid's DEFENDER role
  // (the NPC/zombie horde is the grid attacker and never gets manual
  // control), so the mapping is reversed there. brawlDefenderPhase/
  // brawlAttackerPhase run one after the other (never simultaneously), so
  // both sides being manual in the same round is fine.
  const attackerManual = isBrawl && !isAmbush && !attacker.isComputer;
  const defenderManual =
    isBrawl && (isAmbush ? !attacker.isComputer : !!defender && !defender.isComputer);

  // ── Initial formation per side/mode — every attacker looks different
  // depending on who they are. A real player's own army always forms up
  // as its filled army-slot squads (buildSquadChunks); NPC/garrison sides
  // get a role-appropriate shape instead. ──
  const squadCountFor = (player: Player): number => squadGroupCount(player.militia, player.riders);

  const attackerFormation: FormationSpec = isBrawl
    ? { kind: 'compact' } // brawl: a single tall, narrow formation
    : isAmbush
      ? { kind: 'triangle' } // NPC ambushers: wedge pointed at the player
      : { kind: 'grouped', groupCount: squadCountFor(attacker) };

  const defenderFormation: FormationSpec | undefined = isBrawl
    ? { kind: 'compact' }
    : isCaravan
      ? { kind: 'columns' } // caravan guards: columns of maximum height
      : isDragonFight
        // The dragon lines up by the normal squad rules for now -- its fixed
        // coiled-dragon silhouette is 7 columns wide and no longer fits the
        // narrower huge board, pending a reworked shape.
        ? { kind: 'grouped', groupCount: squadGroupCount(0, defenderGridTotal) }
        : isPlayerBattle
          ? { kind: 'grouped', groupCount: squadCountFor(defender!) }
          : isAmbush
            ? { kind: 'grouped', groupCount: squadCountFor(attacker) } // real player occupies the defender role here
            : (isTile || isRogue) && tile
              ? { kind: 'grouped', groupCount: Math.max(1, tile.level) } // tile guards: one cluster per tower (tile level)
              : undefined;

  // A fortified tile's level bonus is now a straight % addition to every
  // roll the defending garrison's units make each turn (applies in both
  // tile and rogue-attack modes alike).
  const garrisonRollBonusPct = (isTile || isRogue) && tile
    ? tile.getGarrisonBonusPct(tile.level)
    : (statOverrides?.defenderPctBonus ?? 0);

  // isDragonFight, not isDragon: a simulator test battle fights a dragon in
  // 'player' mode, and should still get the artifacts' dragon-only bonus.
  const attackerArtifactBonus = getArtifactRollBonus(attacker, { isDragon: isDragonFight });
  // In a tile battle (or a rogue attack), the defending side is the tile's
  // stationed garrison, not the owner's hero in person — artifacts like
  // Broken Blade only work when the player's own hero is actually taking
  // part in the fight.
  const defenderArtifactBonus =
    defender && !isTile && !isRogue ? getArtifactRollBonus(defender, { isDragon: isDragonFight }) : 0;
  // Ambush is visually/mechanically reversed: the `attacker` prop holds the
  // real player, but they occupy the DEFENDER role in the fight (the NPC
  // ambushers are the attacker-role grid) — so the real player's artifact
  // bonus has to land on the defender-role roll, or it silently boosts the NPC.
  const attackerRollBonus = isAmbush ? 0 : attackerArtifactBonus;
  const defenderRollBonus = isAmbush ? attackerArtifactBonus : defenderArtifactBonus;

  type BonusEntry = { key: string; label: string; emoji?: string; bonus: number; suffix?: string };
  const buildBonusEntries = (player: Player | undefined): BonusEntry[] =>
    player
      ? getArtifactRollBonusBreakdown(player, { isDragon: isDragonFight }).map(({ artifact, bonus }) => ({
          key: artifact.id,
          label: artifact.name,
          emoji: artifact.emoji,
          bonus,
        }))
      : [];
  const attackerBonusEntries = buildBonusEntries(attacker);
  // Shown as its own badge alongside (or instead of) artifact badges, same
  // spot under the garrison's name -- a fortified tile's level bonus.
  const garrisonBonusEntries: BonusEntry[] =
    garrisonRollBonusPct > 0
      ? [
          {
            key: 'garrison-fortification',
            label: t('battleScreen.fortification'),
            emoji: '🏯',
            bonus: Math.round(garrisonRollBonusPct * 100),
            suffix: '%',
          },
        ]
      : [];
  const defenderBonusEntries = [
    ...buildBonusEntries(isTile || isRogue ? undefined : defender),
    ...garrisonBonusEntries,
  ];

  // ── State ──
  const [battle, setBattle] = useState<GridBattleState>(() =>
    createBattle(
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
      gridCols,
      gridRows
    )
  );
  const [lastEvents, setLastEvents] = useState<TurnEvent[]>([]);
  const [phase, setPhase] = useState<BattlePhase>('ongoing');
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);
  const [showBattlefield, setShowBattlefield] = useState(true);

  // ── Labels ──
  const defenderLabel = isDragon
    ? t('battleScreen.theDragon')
    : isCaravan || isAmbush
      ? isAmbush
        ? isZombieAmbush
          ? t('battleScreen.zombies')
          : t('battleScreen.ambushers')
        : t('battleScreen.caravanGuards')
      // Rogue attack: the tile's garrison is defending, not the player in
      // person -- label it as such (still in the owner's color, see
      // defenderColor below) rather than showing the player's own name.
      : isRogue && tile
        ? t('battleScreen.garrisonOf', { tileName: tile.name })
        : (defender?.name ?? t('battleScreen.guards'));
  const defenderColor = isDragon
    ? '#ff5816'
    : isCaravan || isAmbush
      ? '#f6b03e'
      : defender?.color ?? '#eee';
  const defenderImg = isDragon
    ? 'assets/figures/npc-drac.png'
    : isCaravan || isAmbush
      ? 'assets/figures/npc-saracen.png'
      : defender
        ? getPlayerImageSrc(defender.image, defender.isKnight)
        : 'assets/figures/npc-saracen.png';
  // Center icon between the two portraits: the tile's own sprite for a tile
  // fight, nothing otherwise — dragon/caravan/ambush modes have no third
  // icon to show, since defenderImg is already one of the two side portraits
  // (the NPC's, or the real player's for ambush's reversed roles).
  const modeIconSrc = (isTile || isRogue) && tile?.spriteImage ? tile.spriteImage : undefined;

  // Mode-specific battlefield icons, matching the old duel screen's grid
  // emoji: NPC ambushers/rogue horde occupy the grid's attacker role, the
  // Dragon and caravan guards occupy the defender role.
  const attackerFieldIcon = isZombieAmbush ? '🧟‍♀️' : isAmbush || isRogue ? '👹' : undefined;
  const defenderFieldIcon = isDragon ? '🐉' : isCaravan ? '🥷' : undefined;

  // ── Initial log ──
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    if (isAmbush) {
      const key = isRuins
        ? 'battleScreen.ruinsAttackMessage'
        : isZombieAmbush
          ? 'battleScreen.zombieAttackMessage'
          : 'battleScreen.ambushedMessage';
      say(t(key, { name: attacker.name, units: ambushAttackerUnits! }), 'warning');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resolve result (fed by the grid battle's final casualty tally) ──
  const resolveResult = useCallback(
    (battleOutcome: BattleOutcome, atkKilled: number, defKilled: number): BattleResolution => {
      if (isDragon) return resolveDragonBattle(gameState, attacker, atkKilled, battleOutcome);
      if (isCaravan)
        return resolveCaravanBattle(
          gameState,
          attacker,
          { prize: caravanPrize!, slaves: caravanSlaves, defence: initialDefence },
          atkKilled,
          battleOutcome
        );
      if (isPlayerBattle)
        return resolvePlayerBattle(
          gameState,
          attacker,
          defender!,
          battlefieldUnits!,
          atkKilled,
          defKilled,
          battleOutcome
        );
      if (isAmbush && isRuins) {
        // In ambush shape: attacker(grid)=monsters, defender(grid)=real player.
        return resolveRuinsBattle(gameState, attacker, defKilled, battleOutcome);
      }
      if (isAmbush) {
        // In ambush: attacker(grid)=NPC, defender(grid)=real player.
        // BattleOutcome 'defender' means the player wins the ambush.
        const ambushOutcome: AmbushOutcome =
          battleOutcome === 'defender' ? 'win' : battleOutcome === 'attacker' ? 'defeat' : 'tie';
        const res = resolveAmbush(
          gameState, attacker, ambushAttackerUnits!, defKilled, atkKilled, ambushOutcome, isZombieAmbush
        );
        return {
          outcome: battleOutcome,
          message: res.message,
          victoryBg: ambushOutcome === 'win',
          lostBg: ambushOutcome !== 'win',
        };
      }
      if (isRogue) return resolveRogueAttack(gameState, defender!, tile!, defKilled, battleOutcome);
      return resolveTileBattle(gameState, attacker, defender, tile!, atkKilled, defKilled, battleOutcome);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const finishBattle = useCallback(
    (battleOutcome: BattleOutcome, atkGridKilled: number, defGridKilled: number) => {
      const atkKilled = realLossFromGridLoss(atkGridKilled, attackerSized.scale);
      const defKilled = realLossFromGridLoss(defGridKilled, defenderSized.scale);
      setTimeout(() => {
        const res = resolveResult(battleOutcome, atkKilled, defKilled);
        setOutcome(battleOutcome);
        if (res.victoryBg) setShowVictoryBg(true);
        if (res.lostBg) setShowLostBg(true);
        markScreenResolved();
        updateGameState(gameState);
        setResultMsg(res.message);
        setPhase('result');
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Each turn plays out as a 3-stage micro-animation before the computed
  // result is actually committed to `battle` state: attack/defend icons,
  // then a hit flash on whoever's being attacked, then a death flash on
  // whoever's dying — all against the *pre-turn* snapshot, since combat
  // itself never moves anyone (see engine.ts). Only non-engaged units
  // moving is "invisible" here, same as before — they just animate to
  // their new cell (via CSS transition) once the turn commits.
  const animatingRef = useRef(false);
  const [animPhase, setAnimPhase] = useState<'idle' | 'attack-defend' | 'impact' | 'outcome'>('idle');

  // Manual brawl control: which side (if any) the human is currently placing.
  const [brawlManualSide, setBrawlManualSide] = useState<BattleSide | null>(null);
  // ⚔️ click during a brawl: hand the human's side over to the AI for every
  // remaining round instead of placing manually. Checked fresh each time a
  // new round starts, and also applied immediately to a round already
  // showing the placement UI right when this is clicked (see
  // handleVsIconClick) -- units start moving as soon as it's pressed.
  const [autoResolveBrawl, setAutoResolveBrawl] = useState(false);
  const [instantMove, setInstantMove] = useState(false); // snap (no slide) the human's just-placed units
  const manualBaseRef = useRef<GridBattleState | null>(null); // state a manual phase edits
  const roundActiveRef = useRef(false); // a brawl round is in progress
  const roundStartPosRef = useRef<Map<string, { col: number; row: number }>>(new Map()); // positions at round start, to tell who moved
  const manualAttacksRef = useRef<Record<string, string>>({}); // human's attack orders this round (unitId -> enemyId)

  // The 3-beat combat playback (attack/defend icons -> who's under attack ->
  // everyone's own result at once), then commit the resolved state. Shared
  // by the full-battle and brawl turn handlers.
  const animateCombat = useCallback((finalState: GridBattleState, events: TurnEvent[]) => {
    animatingRef.current = true;
    setLastEvents(events);
    setAnimPhase('attack-defend');
    setTimeout(() => {
      setAnimPhase('impact');
      setTimeout(() => {
        setAnimPhase('outcome');
        setTimeout(() => {
          setAnimPhase('idle');
          animatingRef.current = false;
          setBattle(finalState);
        }, OUTCOME_FLASH_MS);
      }, IMPACT_FLASH_MS);
    }, COMBAT_ANIM_BEAT_MS);
  }, []);

  const brawlOpts = () => ({
    rng: Math.random,
    attackerFlatBonus: attackerRollBonus,
    defenderPctBonus: garrisonRollBonusPct,
    defenderFlatBonus: defenderRollBonus,
  });

  // Slide the units to a moved state (CSS transitions the positions), then run
  // the next phase.
  const animateBrawlMove = (to: GridBattleState, next: () => void) => {
    animatingRef.current = true;
    setLastEvents([]);
    setBattle(to);
    setTimeout(() => {
      animatingRef.current = false;
      next();
    }, BRAWL_MOVE_ANIM_MS);
  };

  // A brawl round: defender moves all its units, then the attacker (planning
  // against the defender's new positions), then one combat resolution. Each
  // side's move is either auto-planned (bot) or hand-placed by the human via
  // the shadow overlay (manual). Held in refs so the auto-advance effect and
  // the ⚔️ click always invoke the current version.
  const brawlResolve = (s: GridBattleState) => {
    roundActiveRef.current = false;
    // Units whose cell changed since the round started defend less
    // effectively this round -- see MOVED_DEFENSE_PENALTY.
    const start = roundStartPosRef.current;
    const movedIds = new Set<string>();
    for (const u of s.units) {
      const p = start.get(u.id);
      if (!p || p.col !== u.col || p.row !== u.row) movedIds.add(u.id);
    }
    // The human-controlled side attacks the enemy it explicitly pointed at, or
    // auto-targets like the bot otherwise — so a unit that simply moved into
    // contact (or was left untouched while already adjacent) always fights,
    // same as an AI unit would; there's no way to opt out of attacking. The
    // bot side always auto-targets. Fully-auto rounds pass no intent.
    const manualS: BattleSide | null = autoResolveBrawl
      ? null
      : attackerManual
        ? 'attacker'
        : defenderManual
          ? 'defender'
          : null;
    let intent: Map<string, string> | undefined;
    if (manualS) {
      intent = new Map();
      const atk = manualAttacksRef.current;
      for (const u of s.units) {
        intent.set(u.id, u.side === manualS ? (atk[u.id] ?? 'auto') : 'auto');
      }
    }
    const { state, events } = resolveBrawlCombat(s, brawlOpts(), movedIds, intent);
    animateCombat(state, events);
  };
  const brawlAttackerPhase = (s: GridBattleState) => {
    if (attackerManual && !autoResolveBrawl) {
      manualBaseRef.current = s;
      setBrawlManualSide('attacker');
      return;
    }
    const moved = applyBrawlMoves(s, planBrawlSide(s, 'attacker', Math.random));
    animateBrawlMove(moved, () => brawlResolve(moved));
  };
  const brawlDefenderPhase = (s: GridBattleState) => {
    if (defenderManual && !autoResolveBrawl) {
      manualBaseRef.current = s;
      setBrawlManualSide('defender');
      return;
    }
    const moved = applyBrawlMoves(s, planBrawlSide(s, 'defender', Math.random));
    animateBrawlMove(moved, () => brawlAttackerPhase(moved));
  };
  const startBrawlRound = () => {
    if (phase !== 'ongoing' || roundActiveRef.current || animatingRef.current || isBattleOver(battle)) return;
    roundActiveRef.current = true;
    roundStartPosRef.current = new Map(battle.units.map((u) => [u.id, { col: u.col, row: u.row }]));
    manualAttacksRef.current = {};
    brawlDefenderPhase(battle);
  };
  const handleManualComplete = (plan: BrawlPlan, attacks: Record<string, string>) => {
    const side = brawlManualSide;
    const base = manualBaseRef.current;
    if (!side || !base) return;
    manualAttacksRef.current = attacks;
    const moved = applyBrawlMoves(base, plan);
    // The twins already showed where these units go, so don't re-animate the
    // move: hide the twins and snap the real units into place in the same
    // render (instant, no slide), then — after a short beat to read the new
    // formation — move on to the next phase / the fight.
    animatingRef.current = true;
    setInstantMove(true);
    setBrawlManualSide(null);
    setLastEvents([]);
    setBattle(moved);
    setTimeout(() => {
      setInstantMove(false);
      animatingRef.current = false;
      if (side === 'defender') brawlAttackerPhase(moved);
      else brawlResolve(moved);
    }, BRAWL_SNAP_HOLD_MS);
  };
  const startBrawlRoundRef = useRef(startBrawlRound);
  startBrawlRoundRef.current = startBrawlRound;
  const handleManualCompleteRef = useRef(handleManualComplete);
  handleManualCompleteRef.current = handleManualComplete;

  const handleNextTurn = useCallback(() => {
    if (phase !== 'ongoing' || animatingRef.current || isBattleOver(battle)) return;
    if (isBrawl) {
      startBrawlRoundRef.current();
      return;
    }
    const { state, events } = stepTurn(battle, {
      rng: Math.random,
      attackerFlatBonus: attackerRollBonus,
      defenderPctBonus: garrisonRollBonusPct,
      defenderFlatBonus: defenderRollBonus,
    });
    // stepTurn now moves first and fights afterwards (same order as a brawl
    // round), so the fight has to play out at the cells everyone ended up in
    // -- animating it against the pre-turn snapshot would draw every mover's
    // 🗡️/💥 on the cell it just left. Slide the movers first, then play the
    // combat beats, exactly like animateBrawlMove -> brawlResolve does.
    const moveEvents = events.filter((e) => e.type === 'move');
    const combatEvents = events.filter((e) => e.type !== 'move');
    if (moveEvents.length === 0) {
      animateCombat(state, combatEvents);
      return;
    }
    const movedTo = new Map(moveEvents.map((e) => [e.unitId, e.to!]));
    const afterMove: GridBattleState = {
      ...battle,
      units: battle.units.map((u) => {
        const to = movedTo.get(u.id);
        return to ? { ...u, col: to.col, row: to.row } : u;
      }),
    };
    animateBrawlMove(afterMove, () => animateCombat(state, combatEvents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, battle, isBrawl, attackerRollBonus, garrisonRollBonusPct, defenderRollBonus, animateCombat]);

  // Trigger resolution exactly once, the moment the grid battle ends —
  // watching `battle` rather than resolving inline inside the setBattle
  // updater above, since updaters can run more than once (React Strict
  // Mode) and finishBattle has real side effects (mutates GameState).
  const finishedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'ongoing' || !isBattleOver(battle) || finishedRef.current) return;
    finishedRef.current = true;
    const attackerLeft = battle.units.filter((u) => u.side === 'attacker').length;
    const defenderLeft = battle.units.filter((u) => u.side === 'defender').length;
    const atkGridKilled = attackerGridTotal - attackerLeft;
    const defGridKilled = defenderGridTotal - defenderLeft;
    const battleOutcome: BattleOutcome =
      battle.status === 'attacker-win' ? 'attacker' : battle.status === 'defender-win' ? 'defender' : 'tie';
    finishBattle(battleOutcome, atkGridKilled, defGridKilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, phase]);

  const handleClose = () => {
    clearScreen();
    if (isCaravan || isPlayerBattle || isAmbush || isRogue) {
      (props as { onClose: () => void }).onClose();
    } else if (isDragon) {
      if (outcome !== 'attacker') setEndTurn();
    } else if (isTile && defender && outcome === 'defender') {
      // Losing a banzai attack on an owned tile returns to the guards
      // encounter instead of ending the turn — any army size can now attempt
      // the battle, so a loss shouldn't be a dead end: the attacker can
      // still pay, sell, accept the loss, or try again with what's left.
      // resolveTileBattle unconditionally marks the encounter "resolved" (so
      // a reload doesn't re-derive it from scratch once it's truly settled),
      // but a loss isn't a settlement here — it's reset so every later step
      // of paying/selling/accepting still routes back through this same
      // encounter instead of afterMoveLogic's reload-dedup guard silently
      // no-op'ing them (leaving the screen stuck on stale button states).
      attacker.hasResolvedTileEncounterThisTurn = false;
      showTileEncounterScreen(gameState, updateGameState);
    } else {
      setEndTurn();
      // Winning a fight for a previously unowned tile claims it — show the claim screen.
      if (isTile && tile && outcome === 'attacker' && tile.owner === attacker.id) {
        showScreen({
          content: React.createElement(TileClaimScreen, {
            tile,
            player: attacker,
            gameState,
            updateGameState,
          }),
        });
      }
    }
  };

  // Every battle auto-plays turns until it ends — no click required —
  // unless the ⚔️ icon is clicked, which switches to step-by-step mode:
  // that first click both cancels the pending auto-advance (manualMode
  // becoming true re-runs this effect, which cleans up the old timer) and
  // performs its own manual step, and every click after it just advances
  // one turn the same way.
  const bothSidesAutomated = attacker.isComputer && (!defender || defender.isComputer);
  // The ⚖️ override makes battles start paused in step-by-step mode (advance
  // one turn per ⚔️ click) instead of auto-playing to the end.
  const [manualMode, setManualMode] = useState(getOverrides().stepByStepCombat);
  useEffect(() => {
    if (phase !== 'ongoing' || manualMode) return;
    const timer = setTimeout(() => handleNextTurn(), AUTO_TURN_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, battle.turn, manualMode]);

  const handleVsIconClick = () => {
    if (phase !== 'ongoing') return;
    // Brawl: hand the human's side over to the AI for the rest of the fight,
    // instead of the non-brawl auto-play/step-by-step toggle below. If a
    // round is already showing the manual placement UI right now, take it
    // over immediately too (AI-planned, same as any other auto round)
    // instead of waiting for the player to finish placing it themselves --
    // units should visibly start moving as soon as this is clicked, not
    // only from the next round onward.
    if (isBrawl) {
      setAutoResolveBrawl(true);
      const side = brawlManualSide;
      const base = manualBaseRef.current;
      if (side && base) {
        setBrawlManualSide(null);
        const moved = applyBrawlMoves(base, planBrawlSide(base, side, Math.random));
        animateBrawlMove(moved, () => (side === 'defender' ? brawlAttackerPhase(moved) : brawlResolve(moved)));
      }
      return;
    }
    setManualMode(true);
    handleNextTurn();
  };

  // Give the player a beat to see the final positions on the battlefield
  // itself, then clear it away — the result panel only appears once the
  // battlefield is gone (see the result-panel render below), not
  // side-by-side with it.
  useEffect(() => {
    if (phase !== 'result') return;
    const timer = setTimeout(() => setShowBattlefield(false), 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  // Auto-close the result screen when every real participant is a bot
  // (a human-vs-NPC battle still has a real human to click "Continue").
  // Waits for the battlefield to actually be gone (the result panel isn't
  // shown before then), so there's still time to read the outcome.
  useEffect(() => {
    if (phase !== 'result' || showBattlefield || !bothSidesAutomated) return;
    const t = setTimeout(() => handleClose(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, showBattlefield, bothSidesAutomated]);

  return (
    <ScreenBackground
      image={
        isRuins
          ? 'assets/screens/ruins.jpg'
          : isRogue
            ? 'assets/screens/raid.jpeg'
            // Zombie-flavored fight: either the ambush interrupt from an
            // abandoned tile's garrison, or a normal tile-claim battle
            // fought directly against one (same zombie: !!tile?.abandoned
            // grid reskin either way, see the createBattle call above).
            : isZombieAmbush || (isTile && !!tile?.abandoned)
              ? 'assets/screens/zombies.jpeg'
              : isAmbush
                ? 'assets/screens/ambush.jpg'
                : 'assets/screens/battle.jpg'
      }
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(assets/screens/lost.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: showLostBg ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(assets/screens/victory.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: showVictoryBg ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      />
      <Fade />

      <div className="battle-screen">
        <div className="battle-names-row">
          <div className="bc-attacker">
            {isAmbush ? (
              <PlayerCard imageSrc={defenderImg} name={defenderLabel} color={defenderColor} showArtifacts={false} />
            ) : isRogue ? (
              <PlayerCard imageSrc="assets/figures/npc-saracen.png" name={attacker.name} color={attacker.color} showArtifacts={false} />
            ) : (
              <PlayerCard player={attacker} showArtifacts={false} />
            )}

            {(attackerBonusEntries.length > 0 || defenderBonusEntries.length > 0) && (
            <div className="battle-artifacts-row">
                {(isAmbush ? defenderBonusEntries : attackerBonusEntries).map((e) => (
                  <span key={e.key} className="battle-artifact-badge">
                    {e.label}{e.emoji ? ` ${e.emoji}` : ''} +{e.bonus}{e.suffix ?? ''}
                  </span>
                ))}
            </div>
          )}
          </div>

          <div className="battle-vs-heading">
            <div
              className={
                'vs-icon' +
                (phase === 'ongoing' && !(isBrawl && autoResolveBrawl) ? ' vs-icon-clickable' : '')
              }
              onClick={phase === 'ongoing' && !(isBrawl && autoResolveBrawl) ? handleVsIconClick : undefined}
              title={isBrawl ? t('battleScreen.autoResolveBrawl') : undefined}
            >
              ⚔️
            </div>
            {/* attackerGridTotal/defenderGridTotal already track whichever
                side is shown on the left/right respectively -- ambush's
                role reversal is baked into their assignment above, so no
                extra isAmbush swap is needed (or correct) here. */}
            <div className="vs-count">
              {attackerGridTotal}
              <span className="vs"> {t('common.vs')} </span>
              {defenderGridTotal}
            </div>
            {modeIconSrc && <SpriteCircleIcon src={modeIconSrc} size="4.5rem" />}
          </div>

          <div className="bc-defender">
            {isAmbush ? (
              <PlayerCard player={attacker} showArtifacts={false} />
            ) : (
              <PlayerCard imageSrc={defenderImg} name={defenderLabel} color={defenderColor} showArtifacts={false} />
            )}

            {(attackerBonusEntries.length > 0 || defenderBonusEntries.length > 0) && (
            <div className="battle-artifacts-row">
                {(isAmbush ? attackerBonusEntries : defenderBonusEntries).map((e) => (
                  <span key={e.key} className="battle-artifact-badge">
                    {e.label}{e.emoji ? ` ${e.emoji}` : ''} +{e.bonus}{e.suffix ?? ''}<br />
                  </span>
                ))}
            </div>
          )}
          </div>
        </div>

        {showBattlefield && (
          <BattlefieldGrid
            battle={battle}
            lastEvents={lastEvents}
            animPhase={animPhase}
            attackerIcon={attackerFieldIcon}
            defenderIcon={defenderFieldIcon}
            brawl={isBrawl}
            large={isLargeAutoBattle}
            manualSide={brawlManualSide ?? undefined}
            onManualComplete={(plan, attacks) => handleManualCompleteRef.current(plan, attacks)}
            instant={instantMove}
          />
        )}

        {phase === 'result' && !showBattlefield && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">
              <span className="battle-result-verdict">
                {isAmbush
                  ? (outcome === 'defender'
                      ? t('battleScreen.ambushRepelled')
                      : outcome === 'attacker'
                        ? t('battleScreen.defeat')
                        : t('battleScreen.bloodyStalemate'))
                  : isRogue
                    ? (outcome === 'defender'
                        ? t('battleScreen.attackRepelled')
                        : outcome === 'attacker'
                          ? t('battleScreen.defeat')
                          : t('battleScreen.bloodyStalemate'))
                    : (outcome === 'attacker'
                        ? t('battleScreen.gloriousVictory')
                        : outcome === 'defender'
                          ? t('battleScreen.defeat')
                          : t('battleScreen.aTie'))}
              </span>
            </div>
            <p className="battle-result-message" style={{ whiteSpace: 'pre-line' }}>{resultMsg}</p>
            <DecoratedButton onClick={handleClose}>
              {isAmbush ? t('battleScreen.keepCalmCarryOn') : t('battleScreen.wasItWorthIt')}
            </DecoratedButton>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
