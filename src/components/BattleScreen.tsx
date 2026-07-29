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
import { rollDice } from '../game/Dice';
import { PlayerCard } from './PlayerCard';
import { DecoratedButton } from './DecoratedButton';
import { BattleOutcome, BattleResolution } from '../actions/battles/common';
import { resolveTileBattle } from '../actions/battles/resolveTileBattle';
import { resolveCaravanBattle } from '../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../actions/battles/resolveDragonBattle';
import { resolvePlayerBattle } from '../actions/battles/resolvePlayerBattle';
import { resolveAmbush, AmbushOutcome } from '../actions/battles/resolveAmbush';
import { DRAGON_UNITS } from '../game/constants';
import { isBrawlMatchup, rollBonus } from '../actions/battles/common';
import { getArtifactRollBonus, getArtifactRollBonusBreakdown } from '../game/artifacts';
import { proportionalTierSplit } from '../game/army';
import { useShakeToRoll } from '../utils/useShakeToRoll';
import { vibrateDiceRoll } from '../utils/vibrateDiceRoll';
import { TileClaimScreen } from './TileClaimScreen';
import '../styles/BattleScreen.css';

type BattlePhase = 'attacker-roll' | 'defender-roll' | 'animating' | 'result';

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
    };

// Duel pair selection: brawl always picks the frontmost survivor of each
// side (rightmost attacker, leftmost defender — the same edge the tier
// split places Militia on, so Militia keeps dying first); a normal battle
// picks uniformly at random from whoever's still alive.
function rightmostAliveIndex(alive: boolean[]): number {
  for (let i = alive.length - 1; i >= 0; i--) if (alive[i]) return i;
  return -1;
}
function leftmostAliveIndex(alive: boolean[]): number {
  for (let i = 0; i < alive.length; i++) if (alive[i]) return i;
  return -1;
}
function randomAliveIndex(alive: boolean[]): number {
  const candidates: number[] = [];
  for (let i = 0; i < alive.length; i++) if (alive[i]) candidates.push(i);
  if (candidates.length === 0) return -1;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const { attacker, gameState, updateGameState } = props;

  // ── Mode extraction (TypeScript narrowing per branch) ──
  const isCaravan = props.mode === 'caravan';
  const isDragon = props.mode === 'dragon';
  const isPlayerBattle = props.mode === 'player';
  const isAmbush = props.mode === 'ambush';
  const isTile = !isCaravan && !isDragon && !isPlayerBattle && !isAmbush;
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

  // Brawl (manual, duel-by-duel) requires a small defence. For tile
  // claims/attacks and caravan raids, it additionally requires the attacker's
  // own army to be small — a big army attacking a weakly-defended tile or
  // caravan fights a normal automatic battle instead of a manual brawl.
  // Other modes (dragon/player/ambush) don't gate on the attacker's army here.
  const isBrawl = isBrawlMatchup(defence, isTile || isCaravan ? attacker.armyPower : 0);

  // The whole kingdom rallies against the dragon, so the attacker's army is the
  // combined units of every player rather than mirroring the dragon's 50.
  // For any other (non-brawl) attack the player commits their FULL army, so the
  // attacker's force is attacker.units — e.g. 20 vs a defence of 6. Brawls stay
  // symmetric single roll-offs (both sides mirror the defence), and ambush keeps
  // the NPC ambusher force here since the player is the defender there.
  // Snapshotted once on mount: the dragon (sum of all armies) and full-army
  // branches read live Player.units, and resolving the battle mutates those in
  // place. Recomputing from the live value would shrink the grid and the
  // "X vs Y" readout after the fight is already decided.
  const attackerUnitsRef = useRef(
    isDragon
      ? gameState.players.reduce((sum, p) => sum + p.units, 0)
      : isAmbush || isBrawl
        ? defence
        : attacker.units
  );
  const attackerUnits = attackerUnitsRef.current;

  const doubleDice = defence > 12 || attackerUnits > 12;

  // A side with a big enough TOTAL army relative to the actual force
  // committed to this encounter rolls smarter: +1 at 2x, +2 at 4x or more.
  // Uses each side's real Player.units where one exists (not attackerUnits/
  // defence, which are just the mirrored grid-display sizes for most modes
  // and would always compare 1:1 to itself).
  // Ambush is exempt — the player is forced into it, not choosing to bring
  // overwhelming numbers, so no tactical edge is awarded either way.
  // Snapshotted once on mount: resolving the battle mutates attacker/defender.units
  // in place, and recomputing from the live value would change the bonus (and the
  // "Great Army" badge) after the fight is already decided.
  const attackerSideUnitsRef = useRef(attacker.armyPower);
  const defenderSideUnitsRef = useRef(defender ? defender.armyPower : defence);
  const attackerSideUnits = attackerSideUnitsRef.current;
  const defenderSideUnits = defenderSideUnitsRef.current;
  const attackerArtifactBonus = getArtifactRollBonus(attacker, { isDragon, isBrawl });
  const defenderArtifactBonus = defender ? getArtifactRollBonus(defender, { isDragon, isBrawl }) : 0;
  const attackerArmyBonus = isAmbush ? 0 : rollBonus(attackerSideUnits, defence);
  // A real player defending their own tile gets no swarm bonus — only the
  // attacker's overwhelming numbers (and NPC defenders: caravan/dragon) earn one.
  const defenderArmyBonus = isAmbush || defender ? 0 : rollBonus(defenderSideUnits, attackerUnits);
  const attackerRollBonus = attackerArmyBonus + attackerArtifactBonus;
  const defenderRollBonus = defenderArmyBonus + defenderArtifactBonus;

  type BonusEntry = { key: string; label: string; emoji?: string; bonus: number };
  const buildBonusEntries = (player: Player | undefined, armyBonus: number): BonusEntry[] => {
    const entries: BonusEntry[] = player
      ? getArtifactRollBonusBreakdown(player, { isDragon, isBrawl }).map(({ artifact, bonus }) => ({
          key: artifact.id,
          label: artifact.name,
          emoji: artifact.emoji,
          bonus,
        }))
      : [];
    if (armyBonus > 0) entries.push({ key: 'army', label: 'Swarm ⭐', bonus: armyBonus });
    return entries;
  };
  const attackerBonusEntries = buildBonusEntries(attacker, attackerArmyBonus);
  const defenderBonusEntries = buildBonusEntries(defender, defenderArmyBonus);

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
  const defAliveRef = useRef<boolean[]>(Array(defence).fill(true));
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
    ? 'The Dragon'
    : isCaravan || isAmbush
      ? isAmbush ? 'Ambushers' : 'Caravan Guards'
      : (defender?.name ?? 'Guards');
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
      say(`${attacker.name} is ambushed by ${ambushAttackerUnits}🥷!`, 'warning');
      return;
    }
    const goal = isCaravan
      ? (caravanSlaves ? `${caravanPrize}🧍 in chains` : `${caravanPrize}🟡 of loot`)
      : isDragon
        ? 'the kingdom'
        : isPlayerBattle
          ? 'glory'
          : tile!.name;
    const defEmoji = isDragon ? '🐉' : isCaravan ? '🥷' : '🧍';
    say(`${attacker.name} attacks ${defenderLabel}'s ${defence}${defEmoji} for ${goal}`, 'info');
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
          { prize: caravanPrize!, slaves: caravanSlaves, defence },
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
      return resolveTileBattle(gameState, attacker, defender, tile!, atkKilled, defKilled, battleOutcome);
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
        setPhase('result');
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Brawl: pick the next duel pair (rightmost attacker, leftmost defender) ──
  const selectBrawlDuel = useCallback(() => {
    const atkIdx = rightmostAliveIndex(atkAliveRef.current);
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

  // ── Automatic battle: random pairs, no manual rolls, no visible dice, one
  // duel every 100ms until a side is wiped. ──
  useEffect(() => {
    if (isBrawl) return;
    let cancelled = false;

    const runDuel = () => {
      if (cancelled) return;
      const atkIdx = randomAliveIndex(atkAliveRef.current);
      const defIdx = randomAliveIndex(defAliveRef.current);
      if (atkIdx === -1 || defIdx === -1) return;

      const rollA = (doubleDice ? rollDice() + rollDice() : rollDice()) + attackerRollBonus;
      const rollD = (doubleDice ? rollDice() + rollDice() : rollDice()) + defenderRollBonus;

      if (rollA > rollD) {
        defAliveRef.current[defIdx] = false;
        totalDefKilledRef.current += 1;
      } else if (rollD > rollA) {
        atkAliveRef.current[atkIdx] = false;
        totalAtkKilledRef.current += 1;
      } // tie: neither dies

      setSelectedAtkIdx(atkIdx);
      setSelectedDefIdx(defIdx);
      setAtkAlive([...atkAliveRef.current]);
      setDefAlive([...defAliveRef.current]);

      const atkLeft = atkAliveRef.current.filter(Boolean).length;
      const defLeft = defAliveRef.current.filter(Boolean).length;

      if (atkLeft === 0 || defLeft === 0) {
        finishBattle(defLeft === 0 ? 'attacker' : 'defender');
        return;
      }

      setTimeout(runDuel, 100);
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
    const roll = rawRoll + attackerRollBonus;
    pendingAtkRollRef.current = roll;
    setRollingAttacker(false);
    setPendingAtkRoll(roll);
    setPhase('defender-roll');
  };

  const onDefenderRollDone = (rawRoll: number) => {
    const roll = rawRoll + defenderRollBonus;
    setRollingDefender(false);
    setLastDefRoll(roll);
    setPhase('animating');

    const aRoll = pendingAtkRollRef.current;
    const { atkIdx, defIdx } = currentDuelRef.current;

    if (aRoll > roll) {
      defAliveRef.current[defIdx] = false;
      totalDefKilledRef.current += 1;
    } else if (roll > aRoll) {
      atkAliveRef.current[atkIdx] = false;
      totalAtkKilledRef.current += 1;
    } // tie: neither dies, same pair duels again

    setTimeout(() => {
      setAtkAlive([...atkAliveRef.current]);
      setDefAlive([...defAliveRef.current]);

      const atkLeft = atkAliveRef.current.filter(Boolean).length;
      const defLeft = defAliveRef.current.filter(Boolean).length;

      if (atkLeft === 0 || defLeft === 0) {
        finishBattle(defLeft === 0 ? 'attacker' : 'defender');
      } else {
        setPendingAtkRoll(null);
        setLastDefRoll(null);
        selectBrawlDuel();
        setPhase('attacker-roll');
      }
    }, 200);
  };

  const handleClose = () => {
    clearScreen();
    if (isCaravan || isPlayerBattle || isAmbush) {
      (props as { onClose: () => void }).onClose();
    } else if (isDragon) {
      if (outcome !== 'attacker') setEndTurn();
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
  // is proportional rather than exact. Riders sit on the outer edge of their
  // column (survive longer) and Militia on the center-facing edge (dies
  // first) — matching Player/Tile's actual militia-first loss ordering, and
  // (in a brawl) the rightmost/leftmost duel-selection order.
  const attackerTierCounts =
    isDragon || isAmbush ? { militia: attackerUnits, riders: 0 } : { militia: attacker.militia, riders: attacker.riders };
  const defenderTierCounts = isTile && defender
    ? { militia: tile!.garrisonMilitia, riders: tile!.garrisonRiders }
    : isPlayerBattle
      ? { militia: defender!.militia, riders: defender!.riders }
      : { militia: defence, riders: 0 };
  const attackerSplit = proportionalTierSplit(attackerUnits, attackerTierCounts.militia, attackerTierCounts.riders);
  const defenderSplit = proportionalTierSplit(defence, defenderTierCounts.militia, defenderTierCounts.riders);

  const attackerGrid = Array.from({ length: attackerUnits }, (_, i) => {
    const emoji = !atkAlive[i] ? '💥' : isAmbush ? '👹' : i < attackerSplit.ridersCount ? '🐎' : '🧍';
    return { emoji, selected: i === selectedAtkIdx };
  });
  const defenderGrid = Array.from({ length: defence }, (_, i) => {
    const emoji = !defAlive[i]
      ? '💥'
      : isDragon
        ? '🐉'
        : isCaravan
          ? '👹'
          : i < defenderSplit.militiaCount
            ? '🧍'
            : '🐎';
    return { emoji, selected: i === selectedDefIdx };
  });

  const battleResultEmoji = isAmbush
    ? (outcome === 'defender' ? '🛡️' : outcome === 'attacker' ? '☠️' : '⚔️')
    : (outcome === 'attacker' ? '⚔️' : outcome === 'defender' ? '☠️' : '🛡️');

  const headerText = isCaravan
    ? 'Caravan Raid!'
    : isDragon
      ? 'Dragon Battle'
      : isPlayerBattle
        ? "Hero's Hour"
        : isAmbush
          ? 'Ambush'
          : isTile
            ? `Battle for ${tile!.name}`
            : 'Battle';

  return (
    <ScreenBackground image={isAmbush ? 'assets/screens/caravan.jpg' : 'assets/screens/battle.jpg'}>
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
        {isBrawl && <div className="battle-brawl-tag">Brawl! ✊</div>}

        <div className="battle-names-row">
          <div className="bc-attacker">
            {isAmbush ? (
              // Ambush is visually reversed: this slot shows the NPC
              // ambushers, whose bonus is defenderRollBonus (attackerRollBonus
              // is the real player's, shown in the bc-defender slot below).
              <PlayerCard imageSrc={defenderImg} name={defenderLabel} color={defenderColor} showArtifacts={false} />
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
            {isAmbush ? defence : attackerUnits}
            <span className="vs"> vs </span>
            {isAmbush ? attackerUnits : defence}
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
              <span key={i} className={'battle-unit' + (u.selected ? ' battle-unit-selected' : '')}>
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
              <span key={i} className={'battle-unit' + (u.selected ? ' battle-unit-selected' : '')}>
                {u.emoji}
              </span>
            ))}
          </div>
        </div>

        {isBrawl && phase === 'attacker-roll' && !rollingAttacker && !isAutoAttacker && (
          <DecoratedButton onClick={handleAttackerRoll}>
            ⚔️ Attack!
          </DecoratedButton>
        )}
        {isBrawl && phase === 'defender-roll' && !isAutoDefender && !rollingDefender && (
          <DecoratedButton onClick={handleDefenderRoll}>
            🛡️ Defend!
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
                      ? 'The ambush is repelled!'
                      : outcome === 'attacker'
                        ? 'Defeat!'
                        : 'A bloody stalemate!')
                  : (outcome === 'attacker'
                      ? 'Glorious victory!'
                      : outcome === 'defender'
                        ? 'Defeat!'
                        : 'A tie!')}
              </span>
            </div>
            <p className="battle-result-message">{resultMsg}</p>
            <DecoratedButton onClick={handleClose}>
              {isAmbush ? '🍀 Keep calm & carry on' : '🩸 Was it worth it?'}
            </DecoratedButton>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
