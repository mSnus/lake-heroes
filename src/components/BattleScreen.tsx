import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved, showScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { say } from '../utils/say';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { DiceWidget, DiceWidgetDouble } from './DiceWidget';
import { rollDiceWide } from '../game/Dice';
import { PlayerCard } from './PlayerCard';
import { DecoratedButton } from './DecoratedButton';
import { BattleOutcome, BattleResolution } from '../actions/battles/common';
import { resolveTileBattle } from '../actions/battles/resolveTileBattle';
import { resolveRogueAttack } from '../actions/battles/resolveRogueAttack';
import { resolveCaravanBattle } from '../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../actions/battles/resolveDragonBattle';
import { resolvePlayerBattle } from '../actions/battles/resolvePlayerBattle';
import { resolveAmbush, AmbushOutcome } from '../actions/battles/resolveAmbush';
import { useT } from '../i18n';
import { DRAGON_UNITS, RIDER_DUEL_MULTIPLIER } from '../game/constants';
import { isBrawlMatchup } from '../actions/battles/common';
import { getArtifactRollBonus, getArtifactRollBonusBreakdown } from '../game/artifacts';
import { proportionalTierSplit } from '../game/army';
import { useShakeToRoll } from '../utils/useShakeToRoll';
import { vibrateDiceRoll } from '../utils/vibrateDiceRoll';
import { TileClaimScreen } from './TileClaimScreen';
import { showTileEncounterScreen } from '../actions/afterMoveLogic';
import '../styles/BattleScreen.css';

type BattlePhase = 'attacker-roll' | 'defender-roll' | 'animating' | 'result';

// Pause between one duel resolving and the next pair being selected/rolled —
// applies to both the automatic (random-pair) loop and the brawl's manual
// round-to-round transition.
const DUEL_PAIR_DELAY_MS = 300;

// Riders (knights) hit harder than Militia in an automatic (non-brawl) duel —
// their hidden roll counts for 130% of a Militia roll.

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

// Duel pair selection: leftmost survivor of each side, in both brawl and
// automatic battles — the tier split places Riders at the low-index end for
// both attacker and defender, so Riders in a mixed army fight (and die)
// first, Militia only once the Riders are gone.
function leftmostAliveIndex(alive: boolean[]): number {
  for (let i = 0; i < alive.length; i++) if (alive[i]) return i;
  return -1;
}

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
  const isClaim = isTile && !props.defender;
  // Ambush is narratively reversed: the `attacker` prop holds the real
  // player (the one who must click "Defend"), while the NPC ambushers
  // occupy the attacker role and always auto-roll. So the defender side's
  // bot-check has to look at `attacker.isComputer` for this mode specifically.
  const isAutoDefender =
    isCaravan || isDragon || isClaim || (props.defender?.isComputer ?? false) || (isAmbush && attacker.isComputer);
  const isAutoAttacker = isAmbush || attacker.isComputer;

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

  // `defence` itself is read live from props.tile/etc. every render, which
  // is fine while the fight is in progress — but resolving the battle
  // mutates the underlying tile/player (garrison reset to 0 on a raze/claim,
  // real losses on a defeat), and this component stays mounted showing the
  // result afterward. Snapshot it once so everything derived from it below
  // (isBrawl, the header, the defender grid) keeps showing the fight as it
  // started, not what's left of it — otherwise a razed tile's defence
  // dropping to 0 could even flip a non-brawl fight into showing the
  // "Brawl!" tag retroactively.
  const defenceRef = useRef(defence);
  const initialDefence = defenceRef.current;

  // Same snapshot problem as `defence` above, but for the attacker: resolving
  // a tile battle also deducts the attacker's own combat losses from
  // attacker.units (see resolveTileBattle), which runs before this component
  // unmounts. Reading attacker.armyPower live here would let a large army
  // that just took heavy losses drop below BRAWL_THRESHOLD *after* the fight
  // was already decided, flipping on the "Brawl!" tag retroactively on the
  // result screen for what was actually a normal automatic battle throughout.
  const attackerArmyPowerRef = useRef(attacker.armyPower);
  const initialAttackerArmyPower = attackerArmyPowerRef.current;

  // Brawl (manual, duel-by-duel) requires a small defence. For tile
  // claims/attacks and caravan raids, it additionally requires the attacker's
  // own army to be small — a big army attacking a weakly-defended tile or
  // caravan fights a normal automatic battle instead of a manual brawl.
  // Other modes (dragon/player/ambush) don't gate on the attacker's army here.
  const isBrawl = isBrawlMatchup(initialDefence, isTile || isCaravan ? initialAttackerArmyPower : 0);

  // The whole kingdom rallies against the dragon, so the attacker's army is the
  // combined units of every player rather than mirroring the dragon's 50.
  // For any other attack — brawl or not — the player commits their FULL army,
  // so the attacker's force is attacker.units — e.g. 6 vs a defence of 5.
  // Ambush is the one exception: the player is the DEFENDER there, so the
  // "attacker" side is the NPC ambusher force, which the defence variable
  // already holds by definition for that mode.
  // Snapshotted once on mount: this and the full-army branches read live
  // Player.units, and resolving the battle mutates those in place.
  // Recomputing from the live value would shrink the grid and the "X vs Y"
  // readout after the fight is already decided.
  const attackerUnitsRef = useRef(isAmbush ? initialDefence : attacker.units);
  const attackerUnits = attackerUnitsRef.current;

  const doubleDice = initialDefence > 12 || attackerUnits > 12;

  // Tier split (Militia vs Riders) for each side's unit grid — computed here
  // (rather than down by the grid JSX) because the automatic non-brawl duel
  // loop also needs it, to know whether a given duel index is a Rider for
  // the RIDER_DUEL_MULTIPLIER bonus. Riders sit on the outer edge of their
  // column (survive longer) and Militia on the center-facing edge (dies
  // first) — matching Player/Tile's actual militia-first loss ordering, and
  // (in a brawl) the rightmost/leftmost duel-selection order.
  const attackerTierCounts = isAmbush
    ? { militia: attackerUnits, riders: 0 }
    : { militia: attacker.militia, riders: attacker.riders };
  const defenderTierCounts = (isTile || isRogue) && defender
    ? { militia: tile!.garrisonMilitia, riders: tile!.garrisonRiders }
    : isPlayerBattle
      ? { militia: defender!.militia, riders: defender!.riders }
      : isDragon
        // The Dragon 🐉 fights like a Rider 🐎 — full RIDER_DUEL_MULTIPLIER.
        ? { militia: 0, riders: initialDefence }
        : { militia: initialDefence, riders: 0 };
  const attackerSplit = proportionalTierSplit(attackerUnits, attackerTierCounts.militia, attackerTierCounts.riders);
  const defenderSplit = proportionalTierSplit(initialDefence, defenderTierCounts.militia, defenderTierCounts.riders);

  // A fortified tile's level bonus is now a straight addition to the
  // defender's roll (proportional to that roll), not a multiplier baked
  // into the garrison's static power/headcount — applies in both brawl and
  // automatic duels alike.
  const garrisonRollBonusPct = (isTile || isRogue) && tile ? tile.getGarrisonBonusPct(tile.level) : 0;

  const attackerArtifactBonus = getArtifactRollBonus(attacker, { isDragon, isBrawl });
  // In a tile battle (or a rogue attack), the defending side is the tile's
  // stationed garrison, not the owner's hero in person — artifacts like
  // Broken Blade only work when the player's own hero is actually taking
  // part in the fight.
  const defenderArtifactBonus =
    defender && !isTile && !isRogue ? getArtifactRollBonus(defender, { isDragon, isBrawl }) : 0;
  // Ambush is visually/mechanically reversed: the `attacker` prop holds the
  // real player, but they occupy the DEFENDER role in the duel (the NPC
  // ambushers auto-roll as the attacker role) — so the real player's
  // artifact bonus has to land on the defender-role roll, not the
  // attacker-role one, or it silently boosts the NPC instead.
  const attackerRollBonus = isAmbush ? 0 : attackerArtifactBonus;
  const defenderRollBonus = isAmbush ? attackerArtifactBonus : defenderArtifactBonus;

  type BonusEntry = { key: string; label: string; emoji?: string; bonus: number };
  const buildBonusEntries = (player: Player | undefined): BonusEntry[] =>
    player
      ? getArtifactRollBonusBreakdown(player, { isDragon, isBrawl }).map(({ artifact, bonus }) => ({
          key: artifact.id,
          label: artifact.name,
          emoji: artifact.emoji,
          bonus,
        }))
      : [];
  const attackerBonusEntries = buildBonusEntries(attacker);
  const defenderBonusEntries = buildBonusEntries(isTile || isRogue ? undefined : defender);

  // ── State ──
  const [phase, setPhase] = useState<BattlePhase>('attacker-roll');
  const [rollingAttacker, setRollingAttacker] = useState(false);
  const [rollingDefender, setRollingDefender] = useState(false);
  const [pendingAtkRoll, setPendingAtkRoll] = useState<number | null>(null);
  const [lastDefRoll, setLastDefRoll] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);
  const [atkRollKey, setAtkRollKey] = useState(0);
  const [defRollKey, setDefRollKey] = useState(0);

  // Per-unit alive tracking (replaces the old "how many left" counters) so a
  // single duel can kill exactly one specific unit — the rightmost/leftmost
  // survivor in a brawl, a random survivor in a normal battle — rather than
  // a roll wiping out `roll` units at once.
  const atkAliveRef = useRef<boolean[]>(Array(attackerUnits).fill(true));
  const defAliveRef = useRef<boolean[]>(Array(initialDefence).fill(true));
  const [atkAlive, setAtkAlive] = useState<boolean[]>(() => [...atkAliveRef.current]);
  const [defAlive, setDefAlive] = useState<boolean[]>(() => [...defAliveRef.current]);
  const [selectedAtkIdx, setSelectedAtkIdx] = useState<number | null>(null);
  const [selectedDefIdx, setSelectedDefIdx] = useState<number | null>(null);

  // ── Refs (stable across animation timeouts) ──
  const totalAtkKilledRef = useRef(0);
  const totalDefKilledRef = useRef(0);
  const pendingAtkRollRef = useRef(0);
  const currentDuelRef = useRef<{ atkIdx: number; defIdx: number }>({ atkIdx: -1, defIdx: -1 });

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
        ? getPlayerImageSrc(defender.image, defender.fame)
        : 'assets/figures/npc-saracen.png';

  // ── Initial log ──
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    if (isAmbush) {
      say(t('battleScreen.ambushedMessage', { name: attacker.name, units: ambushAttackerUnits! }), 'warning');
      return;
    }
    const goal = isCaravan
      ? (caravanSlaves ? t('battleScreen.goalChains', { amount: caravanPrize! }) : t('battleScreen.goalLoot', { amount: caravanPrize! }))
      : isDragon
        ? t('battleScreen.goalKingdom')
        : isPlayerBattle
          ? t('battleScreen.goalGlory')
          : tile!.name;
    const defEmoji = isDragon ? '🐉' : isCaravan ? '🥷' : '🧍';
    say(t('battleScreen.attacksMessage', { attacker: attacker.name, defender: defenderLabel, defence: initialDefence, emoji: defEmoji, goal }), 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resolve result (shared by the brawl click-flow and the automatic loop) ──
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
        // In ambush: attacker=NPC(left), defender=player(right).
        // BattleOutcome 'defender' means player wins the ambush.
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
      if (isRogue) return resolveRogueAttack(gameState, defender!, tile!, defKilled, battleOutcome, initialDefence);
      return resolveTileBattle(gameState, attacker, defender, tile!, atkKilled, defKilled, battleOutcome, initialDefence);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const finishBattle = useCallback(
    (battleOutcome: BattleOutcome) => {
      setTimeout(() => {
        const res = resolveResult(battleOutcome, totalAtkKilledRef.current, totalDefKilledRef.current);
        setOutcome(battleOutcome);
        if (res.victoryBg) setShowVictoryBg(true);
        if (res.lostBg) setShowLostBg(true);
        markScreenResolved();
        updateGameState(gameState);
        setResultMsg(res.message);
        setSelectedAtkIdx(null);
        setSelectedDefIdx(null);
        setPhase('result');
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Brawl: pick the next duel pair (leftmost survivor of each side) ──
  const selectBrawlDuel = useCallback(() => {
    const atkIdx = leftmostAliveIndex(atkAliveRef.current);
    const defIdx = leftmostAliveIndex(defAliveRef.current);
    currentDuelRef.current = { atkIdx, defIdx };
    setSelectedAtkIdx(atkIdx);
    setSelectedDefIdx(defIdx);
  }, []);

  useEffect(() => {
    if (!isBrawl) return;
    selectBrawlDuel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Automatic battle: leftmost pair on each side, no manual rolls, no
  // visible dice, one duel every 100ms until a side is wiped. ──
  useEffect(() => {
    if (isBrawl) return;
    let cancelled = false;

    const runDuel = () => {
      if (cancelled) return;
      const atkIdx = leftmostAliveIndex(atkAliveRef.current);
      const defIdx = leftmostAliveIndex(defAliveRef.current);
      if (atkIdx === -1 || defIdx === -1) return;

      const atkIsRider = atkIdx < attackerSplit.ridersCount;
      const defIsRider = defIdx < defenderSplit.ridersCount;

      const rawRollA = rollDiceWide() * (atkIsRider ? RIDER_DUEL_MULTIPLIER : 1) + attackerRollBonus;
      const baseRollD = rollDiceWide() * (defIsRider ? RIDER_DUEL_MULTIPLIER : 1);
      const rawRollD = baseRollD + baseRollD * garrisonRollBonusPct + defenderRollBonus;
      const rollA = Math.round(rawRollA);
      const rollD = Math.round(rawRollD);

      // If it's the last unit standing on both sides, a tied roll is a
      // mutual kill (a genuine battle tie) rather than "neither dies, fight
      // again" — otherwise two full armies down to their last duelist could
      // tie-and-retry forever.
      const isFinalPair =
        atkAliveRef.current.filter(Boolean).length === 1 &&
        defAliveRef.current.filter(Boolean).length === 1;

      if (rollA > rollD) {
        defAliveRef.current[defIdx] = false;
        totalDefKilledRef.current += 1;
      } else if (rollD > rollA) {
        atkAliveRef.current[atkIdx] = false;
        totalAtkKilledRef.current += 1;
      } else if (isFinalPair) {
        atkAliveRef.current[atkIdx] = false;
        defAliveRef.current[defIdx] = false;
        totalAtkKilledRef.current += 1;
        totalDefKilledRef.current += 1;
      } // non-final tie: neither dies, same pair duels again

      setSelectedAtkIdx(atkIdx);
      setSelectedDefIdx(defIdx);
      setAtkAlive([...atkAliveRef.current]);
      setDefAlive([...defAliveRef.current]);

      const atkLeft = atkAliveRef.current.filter(Boolean).length;
      const defLeft = defAliveRef.current.filter(Boolean).length;

      if (atkLeft === 0 || defLeft === 0) {
        finishBattle(atkLeft === 0 && defLeft === 0 ? 'tie' : defLeft === 0 ? 'attacker' : 'defender');
        return;
      }

      setTimeout(runDuel, DUEL_PAIR_DELAY_MS);
    };

    runDuel();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Roll handlers (brawl only) ──
  const handleAttackerRoll = () => {
    // Called directly from the click handler, so this is still within the
    // user-gesture window the Vibration API requires on Chrome.
    vibrateDiceRoll();
    setAtkRollKey((k) => k + 1);
    setRollingAttacker(true);
  };

  const handleDefenderRoll = () => {
    vibrateDiceRoll();
    setDefRollKey((k) => k + 1);
    setRollingDefender(true);
  };

  useShakeToRoll(isBrawl && phase === 'attacker-roll' && !rollingAttacker && !isAutoAttacker, handleAttackerRoll);
  useShakeToRoll(isBrawl && phase === 'defender-roll' && !isAutoDefender && !rollingDefender, handleDefenderRoll);

  // ── Auto-roll attacker (NPC in ambush, or any bot) — brawl only ──
  useEffect(() => {
    if (!isBrawl || phase !== 'attacker-roll' || !isAutoAttacker) return;
    const t = setTimeout(() => {
      setAtkRollKey((k) => k + 1);
      setRollingAttacker(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isBrawl, phase, isAutoAttacker]);

  // ── Auto-roll defender (NPC) — brawl only ──
  useEffect(() => {
    if (!isBrawl || phase !== 'defender-roll' || !isAutoDefender) return;
    const t = setTimeout(() => {
      setDefRollKey((k) => k + 1);
      setRollingDefender(true);
    }, 600);
    return () => clearTimeout(t);
  }, [isBrawl, phase, isAutoDefender]);

  const onAttackerRollDone = (rawRoll: number) => {
    const isRider = currentDuelRef.current.atkIdx < attackerSplit.ridersCount;
    const baseRoll = rawRoll * (isRider ? RIDER_DUEL_MULTIPLIER : 1);
    const roll = Math.round(baseRoll + attackerRollBonus);
    pendingAtkRollRef.current = roll;
    setRollingAttacker(false);
    setPendingAtkRoll(roll);
    setPhase('defender-roll');
  };

  const onDefenderRollDone = (rawRoll: number) => {
    const isRider = currentDuelRef.current.defIdx < defenderSplit.ridersCount;
    const baseRoll = rawRoll * (isRider ? RIDER_DUEL_MULTIPLIER : 1);
    const roll = Math.round(baseRoll + baseRoll * garrisonRollBonusPct + defenderRollBonus);
    setRollingDefender(false);
    setLastDefRoll(roll);
    setPhase('animating');

    const aRoll = pendingAtkRollRef.current;
    const { atkIdx, defIdx } = currentDuelRef.current;

    // Last unit standing on both sides: a tied roll is a mutual kill (a
    // genuine battle tie), not "neither dies, fight again" -- otherwise the
    // last pair could tie-and-retry forever.
    const isFinalPair =
      atkAliveRef.current.filter(Boolean).length === 1 &&
      defAliveRef.current.filter(Boolean).length === 1;

    if (aRoll > roll) {
      defAliveRef.current[defIdx] = false;
      totalDefKilledRef.current += 1;
    } else if (roll > aRoll) {
      atkAliveRef.current[atkIdx] = false;
      totalAtkKilledRef.current += 1;
    } else if (isFinalPair) {
      atkAliveRef.current[atkIdx] = false;
      defAliveRef.current[defIdx] = false;
      totalAtkKilledRef.current += 1;
      totalDefKilledRef.current += 1;
    } // non-final tie: neither dies, same pair duels again

    setTimeout(() => {
      setAtkAlive([...atkAliveRef.current]);
      setDefAlive([...defAliveRef.current]);

      const atkLeft = atkAliveRef.current.filter(Boolean).length;
      const defLeft = defAliveRef.current.filter(Boolean).length;

      if (atkLeft === 0 || defLeft === 0) {
        finishBattle(atkLeft === 0 && defLeft === 0 ? 'tie' : defLeft === 0 ? 'attacker' : 'defender');
      } else {
        setPendingAtkRoll(null);
        setLastDefRoll(null);
        selectBrawlDuel();
        setPhase('attacker-roll');
      }
    }, DUEL_PAIR_DELAY_MS);
  };

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

  // Auto-close the result screen when every real participant is a bot
  // (a human-vs-NPC battle still has a real human to click "Continue").
  // Longer delay than the roll auto-triggers, so there's time to read the outcome.
  const bothSidesAutomated = attacker.isComputer && (!defender || defender.isComputer);
  useEffect(() => {
    if (phase !== 'result' || !bothSidesAutomated) return;
    const t = setTimeout(() => handleClose(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bothSidesAutomated]);

  // ── Unit grid: 💥 for the dead, a red ring around the current duel's pair ──
  // Riders (🐎) vs Militia (🧍): only a real single-Player army has a tier
  // breakdown to show — the dragon's combined kingdom army, and NPC caravan/
  // ambush/wild-guard defenders, render as plain Militia. Tile defence is
  // sized by weighted garrison *power*, not garrison headcount, so its split
  // is proportional rather than exact. Riders sit at the low-index end of
  // both columns (fight and die first in a mixed army) and Militia at the
  // high-index end (survive until the Riders are gone) — matching the
  // leftmost-first duel-selection order used in both brawl and automatic
  // battles.
  const attackerGrid = Array.from({ length: attackerUnits }, (_, i) => {
    const emoji = !atkAlive[i] ? '💥' : isAmbush || isRogue ? '👹' : i < attackerSplit.ridersCount ? '🐎' : '🧍';
    return { emoji, selected: i === selectedAtkIdx };
  });
  const defenderGrid = Array.from({ length: initialDefence }, (_, i) => {
    const emoji = !defAlive[i]
      ? '💥'
      : isDragon
        ? '🐉'
        : isCaravan
          ? '👹'
          : i < defenderSplit.ridersCount
            ? '🐎'
            : '🧍';
    return { emoji, selected: i === selectedDefIdx };
  });

  const battleResultEmoji = isAmbush
    ? (outcome === 'defender' ? '🛡️' : outcome === 'attacker' ? '☠️' : '⚔️')
    : (outcome === 'attacker' ? '⚔️' : outcome === 'defender' ? '☠️' : '🛡️');

  const headerText = isCaravan
    ? t('battleScreen.caravanRaid')
    : isDragon
      ? t('battleScreen.dragonBattle')
      : isPlayerBattle
        ? t('battleScreen.heroHour')
        : isAmbush
          ? t('battleScreen.ambush')
          : isTile || isRogue
            ? t('battleScreen.battleFor', { tileName: tile!.name })
            : t('battleScreen.battle');

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

      {isBrawl && rollingAttacker &&
        (doubleDice ? (
          <DiceWidgetDouble key={`a-${atkRollKey}`} onRoll={onAttackerRollDone} />
        ) : (
          <DiceWidget key={`a-${atkRollKey}`} rolling={true} onRoll={onAttackerRollDone} />
        ))}
      {isBrawl && rollingDefender &&
        (doubleDice ? (
          <DiceWidgetDouble key={`d-${defRollKey}`} onRoll={onDefenderRollDone} />
        ) : (
          <DiceWidget key={`d-${defRollKey}`} rolling={true} onRoll={onDefenderRollDone} />
        ))}

      <div className="battle-screen">
        <div className="battle-header">{headerText}</div>
        {isBrawl && <div className="battle-brawl-tag">{t('battleScreen.brawl')} ✊</div>}

        <div className="battle-names-row">
          <div className="bc-attacker">
            {isAmbush ? (
              // Ambush is visually reversed: this slot shows the NPC
              // ambushers, whose bonus is defenderRollBonus (attackerRollBonus
              // is the real player's, shown in the bc-defender slot below).
              <PlayerCard imageSrc={defenderImg} name={defenderLabel} color={defenderColor} showArtifacts={false} />
            ) : isRogue ? (
              // `attacker` is the synthetic horde Player here — show a
              // generic NPC card instead (its .image isn't a real figure key).
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
          <div className="battle-vs-units">
            <div className='vs-icon'>⚔️</div>
            {isAmbush ? initialDefence : attackerUnits}
            <span className="vs"> {t('common.vs')} </span>
            {isAmbush ? attackerUnits : initialDefence}
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



        <div className="battle-field">
          <div className="battle-units bc-attacker">
            {attackerGrid.map((u, i) => (
              <span key={i} className={'battle-unit' + (!isBrawl ? ' battle-unit-small' : '') + (u.selected ? ' battle-unit-selected' : '')}>
                {u.emoji}
              </span>
            ))}
          </div>

          <div className="battle-field-vs">
            {pendingAtkRoll !== null && (
              <span className="bf-roll">⚔️&nbsp;{pendingAtkRoll}</span>
            )}
            <span className="bf-sep"></span>
            {lastDefRoll !== null && (
              <span className="bf-roll">{lastDefRoll}&nbsp;🛡️</span>
            )}
          </div>

          <div className="battle-units bc-defender">
            {defenderGrid.map((u, i) => (
              <span key={i} className={'battle-unit' + (!isBrawl ? ' battle-unit-small' : '') + (u.selected ? ' battle-unit-selected' : '')}>
                {u.emoji}
              </span>
            ))}
          </div>
        </div>

        {isBrawl && phase === 'attacker-roll' && !rollingAttacker && !isAutoAttacker && (
          <DecoratedButton onClick={handleAttackerRoll}>
            ⚔️ {t('battleScreen.attack')}
          </DecoratedButton>
        )}
        {isBrawl && phase === 'defender-roll' && !isAutoDefender && !rollingDefender && (
          <DecoratedButton onClick={handleDefenderRoll}>
            🛡️ {t('battleScreen.defend')}
          </DecoratedButton>
        )}

        {phase === 'result' && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">
              {battleResultEmoji}
              <br />
              <span className="battle-result-verdict">
                {isAmbush
                  ? (outcome === 'defender'
                      ? t('battleScreen.ambushRepelled')
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
            <p className="battle-result-message">{resultMsg}</p>
            <DecoratedButton onClick={handleClose}>
              {isAmbush ? t('battleScreen.keepCalmCarryOn') : t('battleScreen.wasItWorthIt')}
            </DecoratedButton>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
