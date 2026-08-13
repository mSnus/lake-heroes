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
import { useT } from '../i18n';
import { DRAGON_UNITS, BATTLEFIELD_COLS, BATTLEFIELD_ROWS, BRAWL_COLS, BRAWL_ROWS, BRAWL_THRESHOLD } from '../game/constants';
import { getArtifactRollBonus, getArtifactRollBonusBreakdown } from '../game/artifacts';
import { createBattle, stepTurn, isBattleOver, planBrawlSide, applyBrawlMoves, resolveBrawlCombat, BrawlPlan } from '../game/battleGrid/engine';
import { sizeArmyForGrid, realLossFromGridLoss } from '../game/battleGrid/scale';
import { GridBattleState, TurnEvent, BattleSide } from '../game/battleGrid/types';
import { FormationSpec } from '../game/battleGrid/formations';
import { buildSquadChunks } from '../game/army';
import { TileClaimScreen } from './TileClaimScreen';
import { showTileEncounterScreen } from '../actions/afterMoveLogic';
import '../styles/BattleScreen.css';

type BattlePhase = 'ongoing' | 'result';

// Pause between automatic turns when both sides are bots — fast, but still a
// visible turn-by-turn playback rather than an instant jump to the result.
const AUTO_TURN_DELAY_MS = 250;

// Duration of each beat of the per-turn attack/defend -> hit -> death
// emoji animation (see handleNextTurn).
const COMBAT_ANIM_BEAT_MS = 125;
// How long the brawl move phase animates (units slide to their new cells,
// CSS transition ~0.25s) before the combat resolution plays out.
const BRAWL_MOVE_ANIM_MS = 320;

export type BattleScreenProps =
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode?: 'tile';
      defender?: Player;
      tile?: Tile;
      onClose?: never;
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
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'dragon';
      defender?: never;
      tile?: never;
      onClose?: never;
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
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      mode: 'ambush';
      ambushAttackerUnits: number;
      onClose: () => void;
      defender?: never;
      tile?: never;
      caravanDefence?: never;
      caravanPrize?: never;
      caravanSlaves?: never;
      battlefieldUnits?: never;
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

  let defence: number;
  let defender: Player | undefined;
  let tile: Tile | undefined;
  let caravanPrize: number | undefined;
  let caravanSlaves = false;
  let battlefieldUnits: number | undefined;
  let ambushAttackerUnits: number | undefined;

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
        : { militia: initialDefence, riders: 0 };

  const attackerSizedRef = useRef(sizeArmyForGrid(attackerCompRaw.militia, attackerCompRaw.riders));
  const defenderSizedRef = useRef(sizeArmyForGrid(defenderCompRaw.militia, defenderCompRaw.riders));
  const attackerSized = attackerSizedRef.current;
  const defenderSized = defenderSizedRef.current;
  const attackerGridTotal = attackerSized.militiaCount + attackerSized.ridersCount;
  const defenderGridTotal = defenderSized.militiaCount + defenderSized.ridersCount;
  // Brawl: a small skirmish (both sides at or below BRAWL_THRESHOLD units).
  // These fight on a compact, larger-celled board (see BRAWL_COLS/ROWS) and
  // are the ones that get turn-based / manual control.
  const isBrawl =
    (isTile || isRogue || isPlayerBattle) &&
    attackerGridTotal <= BRAWL_THRESHOLD &&
    defenderGridTotal <= BRAWL_THRESHOLD;
  const gridCols = isBrawl ? BRAWL_COLS : BATTLEFIELD_COLS;
  const gridRows = isBrawl ? BRAWL_ROWS : BATTLEFIELD_ROWS;
  // A side is manually controlled when its player is the human at the
  // controls (the active player) — the attacker in a tile/player fight, the
  // defender when a rogue horde raids a human's tile. The other side (a bot,
  // or a player who isn't taking this turn) is auto-planned.
  const activePlayer = gameState.activePlayer;
  const attackerManual = isBrawl && attacker.id === activePlayer.id && !attacker.isComputer;
  const defenderManual = isBrawl && !!defender && defender.id === activePlayer.id && !defender.isComputer;

  // ── Initial formation per side/mode — every attacker looks different
  // depending on who they are. A real player's own army always forms up
  // as its filled army-slot squads (buildSquadChunks); NPC/garrison sides
  // get a role-appropriate shape instead. ──
  const squadCountFor = (player: Player): number =>
    Math.max(1, buildSquadChunks(player.militia, player.riders, player.armySlots).filter((c) => c.count > 0).length);

  const attackerFormation: FormationSpec = isAmbush
    ? { kind: 'triangle' } // NPC ambushers: wedge pointed at the player
    : { kind: 'grouped', groupCount: squadCountFor(attacker) };

  const defenderFormation: FormationSpec | undefined = isCaravan
    ? { kind: 'columns' } // caravan guards: columns of maximum height
    : isDragon
      ? { kind: 'dragon' } // the dragon's fixed 50-unit coiled-dragon silhouette
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
  const garrisonRollBonusPct = (isTile || isRogue) && tile ? tile.getGarrisonBonusPct(tile.level) : 0;

  const attackerArtifactBonus = getArtifactRollBonus(attacker, { isDragon, isBrawl: false });
  // In a tile battle (or a rogue attack), the defending side is the tile's
  // stationed garrison, not the owner's hero in person — artifacts like
  // Broken Blade only work when the player's own hero is actually taking
  // part in the fight.
  const defenderArtifactBonus =
    defender && !isTile && !isRogue ? getArtifactRollBonus(defender, { isDragon, isBrawl: false }) : 0;
  // Ambush is visually/mechanically reversed: the `attacker` prop holds the
  // real player, but they occupy the DEFENDER role in the fight (the NPC
  // ambushers are the attacker-role grid) — so the real player's artifact
  // bonus has to land on the defender-role roll, or it silently boosts the NPC.
  const attackerRollBonus = isAmbush ? 0 : attackerArtifactBonus;
  const defenderRollBonus = isAmbush ? attackerArtifactBonus : defenderArtifactBonus;

  type BonusEntry = { key: string; label: string; emoji?: string; bonus: number };
  const buildBonusEntries = (player: Player | undefined): BonusEntry[] =>
    player
      ? getArtifactRollBonusBreakdown(player, { isDragon, isBrawl: false }).map(({ artifact, bonus }) => ({
          key: artifact.id,
          label: artifact.name,
          emoji: artifact.emoji,
          bonus,
        }))
      : [];
  const attackerBonusEntries = buildBonusEntries(attacker);
  const defenderBonusEntries = buildBonusEntries(isTile || isRogue ? undefined : defender);

  // ── State ──
  const [battle, setBattle] = useState<GridBattleState>(() =>
    createBattle(
      { militia: attackerSized.militiaCount, riders: attackerSized.ridersCount, formation: attackerFormation },
      { militia: defenderSized.militiaCount, riders: defenderSized.ridersCount, formation: defenderFormation },
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
      ? isAmbush ? t('battleScreen.ambushers') : t('battleScreen.caravanGuards')
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
  // fight, or the NPC art already computed into defenderImg for the
  // dragon/caravan/ambush modes — a plain player-vs-player duel has no
  // third icon to show (defenderImg there is just the defender's own
  // portrait, already shown on the right).
  const modeIconSrc =
    (isTile || isRogue) && tile?.spriteImage
      ? tile.spriteImage
      : isDragon || isCaravan || isAmbush
        ? defenderImg
        : undefined;

  // Mode-specific battlefield icons, matching the old duel screen's grid
  // emoji: NPC ambushers/rogue horde occupy the grid's attacker role, the
  // Dragon and caravan guards occupy the defender role.
  const attackerFieldIcon = isAmbush || isRogue ? '👹' : undefined;
  const defenderFieldIcon = isDragon ? '🐉' : isCaravan ? '🥷' : undefined;

  // ── Initial log ──
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    if (isAmbush) {
      say(t('battleScreen.ambushedMessage', { name: attacker.name, units: ambushAttackerUnits! }), 'warning');
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
      if (isAmbush) {
        // In ambush: attacker(grid)=NPC, defender(grid)=real player.
        // BattleOutcome 'defender' means the player wins the ambush.
        const ambushOutcome: AmbushOutcome =
          battleOutcome === 'defender' ? 'win' : battleOutcome === 'attacker' ? 'defeat' : 'tie';
        const res = resolveAmbush(
          gameState, attacker, ambushAttackerUnits!, defKilled, atkKilled, ambushOutcome
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
  const [animPhase, setAnimPhase] = useState<'idle' | 'attack-defend' | 'hit' | 'death'>('idle');

  // Manual brawl control: which side (if any) the human is currently placing.
  const [brawlManualSide, setBrawlManualSide] = useState<BattleSide | null>(null);
  const manualBaseRef = useRef<GridBattleState | null>(null); // state a manual phase edits
  const roundActiveRef = useRef(false); // a brawl round is in progress

  // The 3-beat combat playback (attack/defend icons -> hit flash -> death
  // flash), then commit the resolved state. Shared by the full-battle and
  // brawl turn handlers.
  const animateCombat = useCallback((finalState: GridBattleState, events: TurnEvent[]) => {
    animatingRef.current = true;
    setLastEvents(events);
    setAnimPhase('attack-defend');
    setTimeout(() => {
      setAnimPhase('hit');
      setTimeout(() => {
        setAnimPhase('death');
        setTimeout(() => {
          setAnimPhase('idle');
          animatingRef.current = false;
          setBattle(finalState);
        }, COMBAT_ANIM_BEAT_MS);
      }, COMBAT_ANIM_BEAT_MS);
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
    const { state, events } = resolveBrawlCombat(s, brawlOpts());
    animateCombat(state, events);
  };
  const brawlAttackerPhase = (s: GridBattleState) => {
    if (attackerManual) {
      manualBaseRef.current = s;
      setBrawlManualSide('attacker');
      return;
    }
    const moved = applyBrawlMoves(s, planBrawlSide(s, 'attacker', Math.random));
    animateBrawlMove(moved, () => brawlResolve(moved));
  };
  const brawlDefenderPhase = (s: GridBattleState) => {
    if (defenderManual) {
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
    brawlDefenderPhase(battle);
  };
  const handleManualComplete = (plan: BrawlPlan) => {
    const side = brawlManualSide;
    const base = manualBaseRef.current;
    if (!side || !base) return;
    setBrawlManualSide(null);
    const moved = applyBrawlMoves(base, plan);
    if (side === 'defender') animateBrawlMove(moved, () => brawlAttackerPhase(moved));
    else animateBrawlMove(moved, () => brawlResolve(moved));
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
    animateCombat(state, events);
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

  const battleResultEmoji = isRogue
    ? '' // a repelled/failed roaming-horde raid shows no emoji before the verdict
    : isAmbush
      ? (outcome === 'defender' ? '🛡️' : outcome === 'attacker' ? '☠️' : '⚔️')
      : (outcome === 'attacker' ? '⚔️' : outcome === 'defender' ? '☠️' : '🛡️');

  return (
    <ScreenBackground image={isAmbush || isRogue ? 'assets/screens/caravan.jpg' : 'assets/screens/battle.jpg'}>
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
                    {e.label}{e.emoji ? ` ${e.emoji}` : ''} +{e.bonus}
                  </span>
                ))}
            </div>
          )}
          </div>

          <div className="battle-vs-heading">
            <div
              className={'vs-icon' + (phase === 'ongoing' ? ' vs-icon-clickable' : '')}
              onClick={phase === 'ongoing' ? handleVsIconClick : undefined}
            >
              ⚔️
            </div>
            <div className="vs-count">
              {isAmbush ? defenderGridTotal : attackerGridTotal}
              <span className="vs"> {t('common.vs')} </span>
              {isAmbush ? attackerGridTotal : defenderGridTotal}
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
                    {e.label}{e.emoji ? ` ${e.emoji}` : ''} +{e.bonus}<br />
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
            manualSide={brawlManualSide ?? undefined}
            onManualComplete={(plan) => handleManualCompleteRef.current(plan)}
          />
        )}

        {phase === 'result' && !showBattlefield && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">
              {battleResultEmoji && (
                <>
                  {battleResultEmoji}
                  <br />
                </>
              )}
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
