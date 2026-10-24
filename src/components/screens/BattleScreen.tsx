import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '../../game/Player';
import { Tile } from '../../game/Tile';
import { GameState } from '../../game/GameState';
import { clearScreen, markScreenResolved } from '../../utils/screenStore';
import { getOverrides } from '../../utils/overridesStore';
import { narrate, say, sayLocal } from '../../utils/say';
import { getPlayerImageSrc } from '../../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from '../snippets/SpriteCircleIcon';
import { PlayerCard } from '../board/PlayerCard';
import { DecoratedButton } from '../ui/DecoratedButton';
import { BattlefieldGrid } from './BattlefieldGrid';
import { CARAVAN_EMOJI, HORDE_EMOJI, toSideIcon } from '../../utils/formatArmy';
import { CaravanPrize } from '../../game/caravanPrize';
import { BattleOutcome, BattleResolution } from '../../actions/battles/common';
import { useT } from '../../i18n';
import { getArtifactRollBonusBreakdown } from '../../game/artifacts';
import { ABSORB_PER_ROLL_POINT } from '../../game/constants';
import {
  isBattleOver,
  planBrawlSide,
  applyBrawlMoves,
  resolveBrawlCombat,
  deployReinforcements,
  sideRemaining,
  energyFor,
  BrawlPlan,
} from '../../game/battleGrid/engine';
import { realLossFromGridLoss } from '../../game/battleGrid/scale';
import { buildBattleSetup, buildInitialBattleState, BattleSetup } from '../../game/battleGrid/battleSetup';
import { dispatchBattleResolution, handleBattleClose } from '../../game/battleGrid/battleResolution';
import { GridBattleState, TurnEvent, BattleSide } from '../../game/battleGrid/types';
import '../../styles/BattleScreen.css';
import Tower from '../snippets/Tower';
import Militia from '../snippets/Militia';
import Rider from '../snippets/Rider';
import { Gold } from '../snippets/Gold';

type BattlePhase = 'ongoing' | 'result';

// Pause between automatic rounds — fast, but still a visible round-by-round
// playback rather than an instant jump to the result.
const AUTO_TURN_DELAY_MS = 250;
// How long the first 🏃 tap stays armed, waiting for the confirming second tap.
const ESCAPE_ARM_MS = 3000;

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

// Army/gold amounts inside a result message ("🧍5", "5🧍", "🐎2", "40🟡"),
// drawn as snippets with the number first.
const RESULT_TOKEN = /🧍(\d+)|(\d+)🧍|🐎(\d+)|(\d+)🐎|(\d+)🟡/gu;

function renderResultText(text: string, color?: string, knight?: boolean): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  RESULT_TOKEN.lastIndex = 0;
  while ((m = RESULT_TOKEN.exec(text))) {
    out.push(text.slice(last, m.index));
    const [, m1, m2, r1, r2, gold] = m;
    const key = m.index;
    if (m1 ?? m2) out.push(<Militia key={key} amount={m1 ?? m2} color={color} knight={knight} />);
    else if (r1 ?? r2) out.push(<Rider key={key} amount={r1 ?? r2} color={color} />);
    else out.push(<Gold key={key} amount={gold} />);
    last = m.index + m[0].length;
  }

  out.push(text.slice(last));
  return out;
}

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
      /** Total guard headcount. */
      caravanDefence: number;
      /** How many of caravanDefence ride camels rather than march. Absent on
       * screens saved before caravans had riders, which reads as none. */
      caravanDefenceRiders?: number;
      caravanPrize: CaravanPrize;
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
      caravanDefenceRiders?: never;
      caravanPrize?: never;
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
      /** Total ambusher headcount. */
      ambushAttackerUnits: number;
      /** How many of ambushAttackerUnits are mounted. Absent on screens saved
       * before ambushes had riders, which reads as none. */
      ambushAttackerRiders?: number;
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
      caravanDefenceRiders?: never;
      caravanPrize?: never;
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
      caravanDefenceRiders?: never;
      caravanPrize?: never;
      battlefieldUnits?: never;
      ambushAttackerUnits?: never;
      ambushAttackerRiders?: never;
      statOverrides?: never;
    };

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const t = useT();
  const { attacker, gameState, updateGameState } = props;

  // Everything mode/army/board/formation/roll-bonus related is decided once,
  // by the same pure function the headless economy simulator uses (see
  // battleSetup.ts) -- frozen for the fight's lifetime the same way the old
  // per-field useRefs did, so resolving the battle (which mutates the
  // underlying tile/player) can't retroactively change what's shown.
  const setupRef = useRef<BattleSetup>(buildBattleSetup(props));
  const {
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
  } = setupRef.current;
  const canControl = attackerManual || defenderManual;

  type BonusEntry = { key: string; label?: string; emoji?: React.ReactNode; bonus: number; suffix?: string };
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
    garrisonAbsorbBonus > 0
      ? [
          {
            key: 'garrison-fortification',
            emoji: <Tower />,
            // Shown as the share of each hit the level is worth soaking,
            // which is what a player can actually reason about.
            bonus: Math.round(garrisonAbsorbBonus * ABSORB_PER_ROLL_POINT * 100),
            suffix: '%',
          },
        ]
      : [];
  const defenderBonusEntries = [
    ...buildBonusEntries(isTile || isRogue ? undefined : defender),
    ...garrisonBonusEntries,
  ];

  // ── State ──
  const [battle, setBattle] = useState<GridBattleState>(() => buildInitialBattleState(setupRef.current));
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
  // isZombieFlavored comes frozen from setupRef (see battleSetup.ts) --
  // winning a claim clears tile.abandoned immediately, which would otherwise
  // flip this back to the Saracen on the results screen for the same fight.
  const defenderImg = isDragon
    ? 'assets/figures/npc-drac.png'
    : isZombieFlavored
      ? 'assets/figures/npc-skeleton.png'
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
  // Built from the same constants the announcement screens use, so the
  // brigands you were warned about are the ones you meet on the grid. A
  // mounted NPC is a plain rider under the hood (same hp/damage), only its
  // emoji differs.
  const attackerFieldIcon = isZombieAmbush
    ? '🧟‍♀️'
    : isAmbush || isRogue
      ? toSideIcon(HORDE_EMOJI)
      : undefined;
  const defenderFieldIcon = isDragon ? '🐉' : isCaravan ? toSideIcon(CARAVAN_EMOJI) : undefined;
  // Militia sprite color per grid side (see BattlefieldGrid's own doc
  // comment on attackerColor/defenderColor) -- attacker is always the real
  // initiating player, and every mode that puts an NPC on the attacker role
  // (ambush/rogue, above) already overrides its icon entirely, so it never
  // falls through to a plain militia sprite anyway. The defender role needs
  // ambush's same role swap the rest of this screen already accounts for
  // (see defenderColor/defenderImg above): the real ambushed player shows
  // in the grid's defender role there, not attacker.
  const attackerFieldColor = attacker.image;
  const defenderFieldColor = isAmbush ? attacker.image : defender?.image;
  const attackerFieldKnight = attacker.isKnight;
  const defenderFieldKnight = isAmbush ? attacker.isKnight : defender?.isKnight;

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
      return;
    }

    // Everyone else is about to watch a frozen board for 20-45s: the grid
    // engine narrates nothing, so without this the only line arrives once the
    // fight is already over. Broadcast-only -- the player who started it is
    // watching it play out.
    const target = isDragon
      ? t('battleScreen.targetDragon')
      : isCaravan
        ? t('battleScreen.targetCaravan')
        : isRogue
          ? t('battleScreen.targetGarrison', { tileName: tile?.name ?? '' })
          : tile
            ? tile.name
            : (defender?.name ?? '');
    if (target) {
      narrate(t('battleScreen.battleStarted', { attackerName: attacker.name, target }), 'warning');
    }
  }, []);

  // ── Resolve result (fed by the grid battle's final casualty tally) ──
  const resolveResult = useCallback(
    (battleOutcome: BattleOutcome, atkKilled: number, defKilled: number): BattleResolution =>
      dispatchBattleResolution(props, setupRef.current, battleOutcome, atkKilled, defKilled),
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
    []
  );

  // The combat beats play out against the post-move positions before the
  // computed result is committed to `battle` state: attack icons, then a hit
  // flash on whoever's being attacked, then each unit's own outcome.
  const animatingRef = useRef(false);
  const [animPhase, setAnimPhase] = useState<'idle' | 'attack-defend' | 'impact' | 'outcome'>('idle');

  // Every battle starts automatic; ⚔️ toggles the local human's side(s)
  // between auto and manual, applied at that side's next movement phase.
  const [manualControl, setManualControl] = useState(false);
  const manualControlRef = useRef(false);
  // Which side (if any) the human is currently placing.
  const [brawlManualSide, setBrawlManualSide] = useState<BattleSide | null>(null);
  const [instantMove, setInstantMove] = useState(false); // snap (no slide) the human's just-placed units
  const manualBaseRef = useRef<GridBattleState | null>(null); // state a manual phase edits
  const roundActiveRef = useRef(false); // a round is in progress
  const roundStartPosRef = useRef<Map<string, { col: number; row: number }>>(new Map()); // positions at round start, to tell who moved
  const manualAttacksRef = useRef<Record<string, string>>({}); // human's attack orders this round (unitId -> enemyId)
  // Set once the human escapes -- every pending phase/animation callback
  // checks it and stands down.
  const escapedRef = useRef(false);
  const [escapeArmed, setEscapeArmed] = useState(false);
  const battleRef = useRef(battle);
  battleRef.current = battle;

  // The 3-beat combat playback (attack/defend icons -> who's under attack ->
  // everyone's own result at once), then commit the resolved state.
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
          if (!escapedRef.current) setBattle(finalState);
        }, OUTCOME_FLASH_MS);
      }, IMPACT_FLASH_MS);
    }, COMBAT_ANIM_BEAT_MS);
  }, []);

  const brawlOpts = () => ({
    rng: Math.random,
    attackerFlatBonus: attackerRollBonus,
    defenderAbsorbBonus: garrisonAbsorbBonus,
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
      if (!escapedRef.current) next();
    }, BRAWL_MOVE_ANIM_MS);
  };

  // A round: reinforcements enter, the defender moves all its units, then the
  // attacker (planning against the defender's new positions), then one combat
  // resolution. Each side's move is auto-planned, or hand-placed by the human
  // via the shadow overlay while manual control is on.
  const brawlResolve = (s: GridBattleState) => {
    if (escapedRef.current) return;
    roundActiveRef.current = false;
    // Units whose cell changed since the round started defend less
    // effectively this round -- see MOVED_DEFENSE_PENALTY.
    const start = roundStartPosRef.current;
    const movedIds = new Set<string>();
    for (const u of s.units) {
      const p = start.get(u.id);
      if (!p || p.col !== u.col || p.row !== u.row) movedIds.add(u.id);
    }

    // A manually placed unit attacks the enemy it explicitly pointed at; every
    // other unit (and every unit of an auto side) picks its own target.
    const attacks = manualAttacksRef.current;
    const intent = Object.keys(attacks).length ? new Map(Object.entries(attacks)) : undefined;

    const { state, events } = resolveBrawlCombat(s, brawlOpts(), movedIds, intent);
    animateCombat(state, events);
  };

  const isManualSide = (side: BattleSide) =>
    manualControlRef.current && (side === 'attacker' ? attackerManual : defenderManual);

  const brawlAttackerPhase = (s: GridBattleState) => {
    if (escapedRef.current) return;
    if (isManualSide('attacker')) {
      manualBaseRef.current = s;
      setBattle(s);
      setBrawlManualSide('attacker');
      return;
    }

    const moved = applyBrawlMoves(s, planBrawlSide(s, 'attacker', Math.random));
    animateBrawlMove(moved, () => brawlResolve(moved));
  };

  const brawlDefenderPhase = (s: GridBattleState) => {
    if (escapedRef.current) return;
    if (isManualSide('defender')) {
      manualBaseRef.current = s;
      setBattle(s);
      setBrawlManualSide('defender');
      return;
    }

    const moved = applyBrawlMoves(s, planBrawlSide(s, 'defender', Math.random));
    animateBrawlMove(moved, () => brawlAttackerPhase(moved));
  };

  const startBrawlRound = () => {
    if (phase !== 'ongoing' || escapedRef.current || roundActiveRef.current || animatingRef.current) return;
    if (isBattleOver(battle)) return;
    roundActiveRef.current = true;
    const deployed = deployReinforcements(battle);
    roundStartPosRef.current = new Map(deployed.units.map((u) => [u.id, { col: u.col, row: u.row }]));
    manualAttacksRef.current = {};
    brawlDefenderPhase(deployed);
  };

  const handleManualComplete = (plan: BrawlPlan, attacks: Record<string, string>) => {
    const side = brawlManualSide;
    const base = manualBaseRef.current;
    if (!side || !base || escapedRef.current) return;
    manualAttacksRef.current = { ...manualAttacksRef.current, ...attacks };
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
      if (escapedRef.current) return;
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
    startBrawlRoundRef.current();
  }, [phase, battle]);

  // Trigger resolution exactly once, the moment the grid battle ends —
  // watching `battle` rather than resolving inline inside the setBattle
  // updater above, since updaters can run more than once (React Strict
  // Mode) and finishBattle has real side effects (mutates GameState).
  const finishedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'ongoing' || !isBattleOver(battle) || finishedRef.current) return;
    finishedRef.current = true;
    const atkGridKilled = attackerGridTotal - sideRemaining(battle, 'attacker');
    const defGridKilled = defenderGridTotal - sideRemaining(battle, 'defender');
    const battleOutcome: BattleOutcome =
      battle.status === 'attacker-win' ? 'attacker' : battle.status === 'defender-win' ? 'defender' : 'tie';
    finishBattle(battleOutcome, atkGridKilled, defGridKilled);
  }, [battle, phase]);

  // What happens once the fight is over and the player (or bot) moves on --
  // shared with the headless economy simulator via handleBattleClose, see
  // battleResolution.ts, so a real and a headless fight can never diverge
  // here. clearScreen() itself stays local: it's a no-op headlessly anyway
  // (screenStore gates it), and is purely a rendering concern either way.
  const handleClose = () => {
    clearScreen();
    handleBattleClose(props, setupRef.current, outcome);
  };

  // Rounds auto-play until the battle ends; the ⚖️ step-by-step override
  // instead waits for a ⏭️ click per round.
  const stepMode = getOverrides().stepByStepCombat;
  useEffect(() => {
    if (phase !== 'ongoing' || stepMode) return;
    const timer = setTimeout(() => handleNextTurn(), AUTO_TURN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, battle.turn, stepMode]);

  /** Debug export: clicking either side's portrait copies the live battle
   * state as JSON -- for pasting into a bug report rather than describing
   * the board by hand. `attackerRoleLabel`/`defenderRoleLabel` mirror the
   * same isAmbush branch the bc-attacker/bc-defender JSX below uses, so the
   * labels always match whichever identity is actually shown in that grid
   * role (ambush/rogue put the real player and the NPC role in different
   * slots depending on mode -- see their PlayerCard branches). */
  const handleCopyBattleDebugState = () => {
    const attackerRoleLabel = isAmbush ? defenderLabel : attacker.name;
    const attackerRoleColor = isAmbush ? defenderColor : attacker.color;
    const defenderRoleLabel = isAmbush ? attacker.name : defenderLabel;
    const defenderRoleColor = isAmbush ? attacker.color : defenderColor;

    const payload = {
      schema: 1,
      exportedAt: new Date().toISOString(),
      battle: {
        cols: battle.cols,
        rows: battle.rows,
        turn: battle.turn,
        status: battle.status,
        phase,
        manualControl,
        // Whose manual placement turn it is right now -- 'auto' when the
        // engine is resolving on its own.
        turnOwner: brawlManualSide ?? 'auto',
      },
      sides: {
        attacker: { label: attackerRoleLabel, color: attackerRoleColor },
        defender: { label: defenderRoleLabel, color: defenderRoleColor },
      },
      units: battle.units.map((u) => ({
        id: u.id,
        side: u.side,
        kind: u.kind,
        col: u.col,
        row: u.row,
        hp: u.hp,
        maxHp: u.maxHp,
        energy: u.energy,
        maxEnergy: energyFor(u.kind),
      })),
      reserves: battle.reserves.map((u) => ({ id: u.id, side: u.side, kind: u.kind })),
      obstacles: battle.obstacles,
    };

    const json = JSON.stringify(payload, null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => sayLocal(t('battleScreen.debugStateCopied'), 'success'))
      .catch(() => sayLocal(t('battleScreen.debugStateCopyFailed'), 'error'));
  };

  const handleVsIconClick = () => {
    if (phase !== 'ongoing' || !canControl) return;
    const next = !manualControlRef.current;
    manualControlRef.current = next;
    setManualControl(next);
    // Back to auto while the placement UI is showing: the AI takes this
    // movement phase over right away.
    const side = brawlManualSide;
    const base = manualBaseRef.current;
    if (!next && side && base) {
      setBrawlManualSide(null);
      const moved = applyBrawlMoves(base, planBrawlSide(base, side, Math.random));
      animateBrawlMove(moved, () => (side === 'defender' ? brawlAttackerPhase(moved) : brawlResolve(moved)));
    }
  };

  // Units of the escaping side that are on the field right now -- lost on escape.
  const escapeLoss = escapeSide ? battle.units.filter((u) => u.side === escapeSide).length : 0;

  // First tap arms (with a warning), a second tap within ESCAPE_ARM_MS escapes:
  // the escaping side loses the battle and every unit on the field, but keeps
  // its reserves.
  const handleEscapeClick = () => {
    if (phase !== 'ongoing' || !escapeSide || finishedRef.current) return;
    if (!escapeArmed) {
      setEscapeArmed(true);
      sayLocal(t('battleScreen.escapeConfirm', { units: escapeLoss }), 'warning');
      setTimeout(() => setEscapeArmed(false), ESCAPE_ARM_MS);
      return;
    }

    escapedRef.current = true;
    finishedRef.current = true;
    roundActiveRef.current = false;
    setBrawlManualSide(null);
    setAnimPhase('idle');
    setLastEvents([]);
    const cur = battleRef.current;
    const lost = cur.units.filter((u) => u.side === escapeSide).length;
    const atkGridKilled = attackerGridTotal - sideRemaining(cur, 'attacker') + (escapeSide === 'attacker' ? lost : 0);
    const defGridKilled = defenderGridTotal - sideRemaining(cur, 'defender') + (escapeSide === 'defender' ? lost : 0);
    setBattle({ ...cur, units: cur.units.filter((u) => u.side !== escapeSide) });
    say(t('battleScreen.escaped', { name: attacker.name, units: lost }), 'warning');
    finishBattle(escapeSide === 'attacker' ? 'defender' : 'attacker', atkGridKilled, defGridKilled);
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

  // Auto-close the result screen whenever a bot initiated the fight (bot vs
  // bot, or bot vs the human's own tile) — the human didn't choose to
  // fight, so there's nothing for them to confirm. Only a battle the human
  // *attacked* themselves waits for a manual click, since they're the one
  // who wanted to see how it went. Waits for the battlefield to actually be
  // gone (the result panel isn't shown before then), so there's still time
  // to read the outcome.
  const resultAutoCloses = attacker.isComputer;
  useEffect(() => {
    if (phase !== 'result' || showBattlefield || !resultAutoCloses) return;
    const t = setTimeout(() => handleClose(), 800);
    return () => clearTimeout(t);
  }, [phase, showBattlefield, resultAutoCloses]);

  return (
    <ScreenBackground
      image={
        isRuins
          ? 'assets/screens/ruins.jpg'
          : isRogue
            ? 'assets/screens/raid.jpeg'
            : isZombieFlavored
              ? 'assets/screens/zombies.jpeg'
              : isAmbush
                ? 'assets/screens/ambush.jpg'
                : 'assets/screens/battle.jpg'
      }
      // screen-common's default vertical centering leaves a top gap whenever
      // the battle content is shorter than the viewport -- brawl mode makes
      // this worse, since its manual Undo/Go controls reserve their height
      // even while hidden (so the battlefield above doesn't jump between
      // auto/manual turns, see .bfg-manual-controls--hidden). Anchoring to
      // the top instead means any leftover space collects at the bottom,
      // which reads as normal rather than as a stray gap above the fight.
      style={{ justifyContent: 'flex-start' }}
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
              <PlayerCard
                imageSrc={defenderImg}
                name={defenderLabel}
                color={defenderColor}
                showArtifacts={false}
                onIconClick={handleCopyBattleDebugState}
              />
            ) : isRogue ? (
              <PlayerCard
                imageSrc="assets/figures/npc-saracen.png"
                name={attacker.name}
                color={attacker.color}
                showArtifacts={false}
                onIconClick={handleCopyBattleDebugState}
              />
            ) : (
              <PlayerCard player={attacker} showArtifacts={false} onIconClick={handleCopyBattleDebugState} />
            )}

            {(attackerBonusEntries.length > 0 || defenderBonusEntries.length > 0) && (
              <div className="battle-artifacts-row">
                {(isAmbush ? defenderBonusEntries : attackerBonusEntries).map((e) => (
                  <span key={e.key} className="battle-artifact-badge">
                    {e.label && <>{e.label} </>}
                    {e.emoji && <> {e.emoji}</>} +{e.bonus}
                    {e.suffix ?? ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="battle-vs-heading">
            <div
              className={'vs-icon' + (phase === 'ongoing' && canControl ? ' vs-icon-clickable' : '')}
              onClick={phase === 'ongoing' && canControl ? handleVsIconClick : undefined}
              title={canControl ? t('battleScreen.controlToggleTitle') : undefined}
            >
              ⚔️
              {/* Always rendered (space reserved via visibility, not
                  unmounted) -- removing it would shrink .battle-vs-heading
                  and pull the battlefield up the moment it hides. */}
              <div className={'auto-label' + (phase === 'ongoing' && canControl ? '' : ' auto-label--hidden')}>
                {manualControl ? t('battleScreen.controlManual') : t('battleScreen.controlAuto')}
                <br />
              </div>
            </div>
            {/* The armies as they entered the fight (left/right already follow
                the grid roles -- ambush's role reversal is baked into the
                setup, so no isAmbush swap here). */}
            <div className="vs-count">
              {attackerGridTotal}
              <span className="vs"> {t('common.vs')} </span>
              {defenderGridTotal}
            </div>
            {modeIconSrc && <SpriteCircleIcon src={modeIconSrc} size="4.5rem" />}
          </div>

          <div className="bc-defender">
            {isAmbush ? (
              <PlayerCard player={attacker} showArtifacts={false} onIconClick={handleCopyBattleDebugState} />
            ) : (
              <PlayerCard
                imageSrc={defenderImg}
                name={defenderLabel}
                color={defenderColor}
                showArtifacts={false}
                onIconClick={handleCopyBattleDebugState}
              />
            )}

            {(attackerBonusEntries.length > 0 || defenderBonusEntries.length > 0) && (
              <div className="battle-artifacts-row">
                {(isAmbush ? attackerBonusEntries : defenderBonusEntries).map((e) => (
                  <span key={e.key} className="battle-artifact-badge">
                    {e.label && <>{e.label} </>}
                    {e.emoji && <> {e.emoji}</>} +{e.bonus}
                    {e.suffix ?? ''}
                    <br />
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
            attackerColor={attackerFieldColor}
            defenderColor={defenderFieldColor}
            attackerKnight={attackerFieldKnight}
            defenderKnight={defenderFieldKnight}
            manualSide={brawlManualSide ?? undefined}
            onManualComplete={(plan, attacks) => handleManualCompleteRef.current(plan, attacks)}
            instant={instantMove}
            extraControls={
              <>
                {stepMode && phase === 'ongoing' && (
                  <div className="shield-button-container" title={t('battleScreen.nextRound')}>
                    <button className="shield-button" onClick={handleNextTurn}>
                      ⏭️
                    </button>
                  </div>
                )}
                {escapeSide && phase === 'ongoing' && (
                  <div
                    className={'shield-button-container' + (escapeArmed ? ' battle-escape-armed' : '')}
                    title={t('battleScreen.escapeTitle', { units: escapeLoss })}
                  >
                    <button className="shield-button" onClick={handleEscapeClick}>
                      🏃
                    </button>
                  </div>
                )}
              </>
            }
          />
        )}

        {phase === 'result' && !showBattlefield && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">
              <span className="battle-result-verdict">
                {isAmbush
                  ? outcome === 'defender'
                    ? t('battleScreen.ambushRepelled')
                    : outcome === 'attacker'
                      ? t('battleScreen.defeat')
                      : t('battleScreen.bloodyStalemate')
                  : isRogue
                    ? outcome === 'defender'
                      ? t('battleScreen.attackRepelled')
                      : outcome === 'attacker'
                        ? t('battleScreen.defeat')
                        : t('battleScreen.bloodyStalemate')
                    : outcome === 'attacker'
                      ? t('battleScreen.gloriousVictory')
                      : outcome === 'defender'
                        ? t('battleScreen.defeat')
                        : t('battleScreen.aTie')}
              </span>
            </div>
            <div className="battle-result-message" style={{ whiteSpace: 'pre-line' }}>
              {renderResultText(
                resultMsg,
                isRogue ? defender?.image : attacker.image,
                isRogue ? defender?.isKnight : attacker.isKnight
              )}
            </div>
            <DecoratedButton onClick={handleClose}>
              {isAmbush ? t('battleScreen.keepCalmCarryOn') : t('battleScreen.wasItWorthIt')}
            </DecoratedButton>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
