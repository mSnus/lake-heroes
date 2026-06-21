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
import { PlayerCard } from './PlayerCard';
import { BattleOutcome, BattleResolution } from '../actions/battles/common';
import { resolveTileBattle } from '../actions/battles/resolveTileBattle';
import { resolveCaravanBattle } from '../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../actions/battles/resolveDragonBattle';
import { resolvePlayerBattle } from '../actions/battles/resolvePlayerBattle';
import { resolveAmbush, AmbushOutcome } from '../actions/battles/resolveAmbush';
import { BRAWL_THRESHOLD, DRAGON_UNITS } from '../game/constants';
import { computeBrawlRound } from '../actions/battles/common';
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

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const { attacker, gameState, updateGameState } = props;

  // ── Mode extraction (TypeScript narrowing per branch) ──
  const isCaravan = props.mode === 'caravan';
  const isDragon = props.mode === 'dragon';
  const isPlayerBattle = props.mode === 'player';
  const isAmbush = props.mode === 'ambush';
  const isTile = !isCaravan && !isDragon && !isPlayerBattle && !isAmbush;
  const isClaim = isTile && !props.defender;
  const isAutoDefender = isCaravan || isDragon || isClaim;
  const isAutoAttacker = isAmbush;

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

  // The whole kingdom rallies against the dragon, so the attacker's army is the
  // combined units of every player rather than mirroring the dragon's 50.
  const attackerUnits = isDragon
    ? gameState.players.reduce((sum, p) => sum + p.units, 0)
    : defence;

  const doubleDice = defence > 12 || attackerUnits > 12;
  const isBrawl = defence <= BRAWL_THRESHOLD;

  // ── State ──
  const [phase, setPhase] = useState<BattlePhase>('attacker-roll');
  const [rollingAttacker, setRollingAttacker] = useState(false);
  const [rollingDefender, setRollingDefender] = useState(false);
  const [displayedAtkKilled, setDisplayedAtkKilled] = useState(0);
  const [displayedDefKilled, setDisplayedDefKilled] = useState(0);
  const [pendingAtkRoll, setPendingAtkRoll] = useState<number | null>(null);
  const [lastDefRoll, setLastDefRoll] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);
  const [atkRollKey, setAtkRollKey] = useState(0);
  const [defRollKey, setDefRollKey] = useState(0);

  // ── Refs (stable across animation timeouts) ──
  const atkUnitsLeftRef = useRef(attackerUnits);
  const defUnitsLeftRef = useRef(defence);
  const totalAtkKilledRef = useRef(0);
  const totalDefKilledRef = useRef(0);
  const pendingAtkRollRef = useRef(0);
  const brawlRoundsRef = useRef(0);

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

  // ── Auto-roll attacker (NPC in ambush) ──
  useEffect(() => {
    if (phase !== 'attacker-roll' || !isAutoAttacker) return;
    const t = setTimeout(() => {
      setAtkRollKey((k) => k + 1);
      setRollingAttacker(true);
    }, 600);
    return () => clearTimeout(t);
  }, [phase, isAutoAttacker]);

  // ── Auto-roll defender (NPC) ──
  useEffect(() => {
    if (phase !== 'defender-roll' || !isAutoDefender) return;
    const t = setTimeout(() => {
      setDefRollKey((k) => k + 1);
      setRollingDefender(true);
    }, 600);
    return () => clearTimeout(t);
  }, [phase, isAutoDefender]);

  // ── Kill animation: defender column first, then attacker column ──
  const animateKills = useCallback(
    (defKills: number, atkKills: number, onDone: () => void) => {
      const total = defKills + atkKills;
      if (total === 0) {
        onDone();
        return;
      }
      let step = 0;
      const next = () => {
        if (step < defKills) {
          setDisplayedDefKilled((prev) => prev + 1);
        } else {
          setDisplayedAtkKilled((prev) => prev + 1);
        }
        step++;
        if (step < total) {
          setTimeout(next, 100);
        } else {
          setTimeout(onDone, 200);
        }
      };
      setTimeout(next, 100);
    },
    []
  );

  // ── Resolve result ──
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
          battleOutcome,
          isBrawl
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
      return resolveTileBattle(gameState, attacker, defender, tile!, atkKilled, battleOutcome);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Roll handlers ──
  const handleAttackerRoll = () => {
    setAtkRollKey((k) => k + 1);
    setRollingAttacker(true);
  };

  const handleDefenderRoll = () => {
    setDefRollKey((k) => k + 1);
    setRollingDefender(true);
  };

  const onAttackerRollDone = (roll: number) => {
    pendingAtkRollRef.current = roll;
    setRollingAttacker(false);
    setPendingAtkRoll(roll);

    // Brawl outcomes are winner-take-all and depend on comparing both rolls,
    // so defender casualties can't be shown until the defender also rolls.
    if (isBrawl) {
      setPhase('defender-roll');
      return;
    }

    // Non-brawl: the attacker's roll alone determines defender casualties —
    // mark them dead right away instead of waiting for the round to end.
    const defKills = Math.min(roll, defUnitsLeftRef.current);
    const newDefLeft = defUnitsLeftRef.current - defKills;

    animateKills(defKills, 0, () => {
      defUnitsLeftRef.current = newDefLeft;
      totalDefKilledRef.current += defKills;
      setPhase('defender-roll');
    });
  };

  const onDefenderRollDone = (roll: number) => {
    setRollingDefender(false);
    setLastDefRoll(roll);
    setPhase('animating');

    const aRoll = pendingAtkRollRef.current;

    let defKills: number, atkKills: number, newDefLeft: number, newAtkLeft: number;
    if (isBrawl) {
      ({ defKills, atkKills, newDefLeft, newAtkLeft } = computeBrawlRound(
        aRoll, roll, defence, defUnitsLeftRef.current, atkUnitsLeftRef.current
      ));
      brawlRoundsRef.current += 1;
    } else {
      // Defender casualties were already resolved and animated in onAttackerRollDone.
      defKills = 0;
      atkKills = Math.min(roll, atkUnitsLeftRef.current);
      newDefLeft = defUnitsLeftRef.current;
      newAtkLeft = atkUnitsLeftRef.current - atkKills;
    }
    // Brawl kills are visual only — except tile defeats, which always cost units
    const willBeDefeat = newAtkLeft <= 0 && newDefLeft > 0;
    const resolveAtkKilled = isBrawl && !(isTile && willBeDefeat) ? 0 : atkKills;
    const resolveDefKilled = isBrawl && !(isTile && willBeDefeat) ? 0 : defKills;
    const newTotalAtkKilled = totalAtkKilledRef.current + resolveAtkKilled;
    const newTotalDefKilled = totalDefKilledRef.current + resolveDefKilled;

    animateKills(defKills, atkKills, () => {
      atkUnitsLeftRef.current = newAtkLeft;
      defUnitsLeftRef.current = newDefLeft;
      totalAtkKilledRef.current = newTotalAtkKilled;
      totalDefKilledRef.current = newTotalDefKilled;

      const brawlRoundsExhausted = isBrawl && brawlRoundsRef.current >= defence;
      if (newDefLeft <= 0 || newAtkLeft <= 0 || brawlRoundsExhausted) {
        const battleOutcome: BattleOutcome =
          newDefLeft <= 0 && newAtkLeft > 0
            ? 'attacker'
            : newAtkLeft <= 0 && newDefLeft > 0
              ? 'defender'
              : 'tie';

        setTimeout(() => {
          const res = resolveResult(battleOutcome, newTotalAtkKilled, newTotalDefKilled);
          setOutcome(battleOutcome);
          if (res.victoryBg) setShowVictoryBg(true);
          if (res.lostBg) setShowLostBg(true);
          markScreenResolved();
          updateGameState(gameState);
          setResultMsg(res.message);
          setPhase('result');
        }, 400);
      } else {
        setPendingAtkRoll(null);
        setLastDefRoll(null);
        setPhase('attacker-roll');
      }
    });
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
        showScreen({ content: React.createElement(TileClaimScreen, { tile, player: attacker }) });
      }
    }
  };

  // ── Unit grid: killed 💥 accumulate on the inner side (toward center) ──
  // Attacker column (left): killed appear at the right end
  const attackerGrid = Array.from({ length: attackerUnits }, (_, i) =>
    i >= attackerUnits - displayedAtkKilled ? '💥' : '🧍'
  );
  // Defender column (right): killed appear at the left end
  const defenderGrid = Array.from({ length: defence }, (_, i) =>
    i < displayedDefKilled ? '💥' : isDragon ? '🐉' : '🧍'
  );

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

      {rollingAttacker &&
        (doubleDice ? (
          <DiceWidgetDouble key={`a-${atkRollKey}`} onRoll={onAttackerRollDone} />
        ) : (
          <DiceWidget key={`a-${atkRollKey}`} rolling={true} onRoll={onAttackerRollDone} />
        ))}
      {rollingDefender &&
        (doubleDice ? (
          <DiceWidgetDouble key={`d-${defRollKey}`} onRoll={onDefenderRollDone} />
        ) : (
          <DiceWidget key={`d-${defRollKey}`} rolling={true} onRoll={onDefenderRollDone} />
        ))}

      <div className="battle-screen">
        <div className="battle-header">{headerText}</div>
        {isBrawl && <div className="battle-brawl-tag">Brawl!</div>}

        <div className="battle-names-row">
          <div className="bc-attacker">
            {isAmbush ? (
              <PlayerCard imageSrc={defenderImg} name={defenderLabel} color={defenderColor} prefix="⚔️" />
            ) : (
              <PlayerCard player={attacker} prefix="⚔️" />
            )}
          </div>
          <div className="bc-defender">
            {isAmbush ? (
              <PlayerCard player={attacker} prefix="🛡️" />
            ) : (
              <PlayerCard imageSrc={defenderImg} name={defenderLabel} color={defenderColor} prefix="🛡️" />
            )}
          </div>
        </div>

        <div className="battle-field">
          <div className="battle-units bc-attacker">
            {attackerGrid.map((emoji, i) => (
              <span key={i} className="battle-unit">
                {emoji}
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
            {defenderGrid.map((emoji, i) => (
              <span key={i} className="battle-unit">
                {emoji}
              </span>
            ))}
          </div>
        </div>

        {phase === 'attacker-roll' && !rollingAttacker && !isAutoAttacker && (
          <button className="game-menu-button battle-roll-btn" onClick={handleAttackerRoll}>
            ⚔️ Attack!
          </button>
        )}
        {phase === 'defender-roll' && !isAutoDefender && !rollingDefender && (
          <button className="game-menu-button battle-roll-btn" onClick={handleDefenderRoll}>
            🛡️ Defend!
          </button>
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
            <button className="game-menu-button" onClick={handleClose}>
              {isAmbush ? '🧭 Ride on' : '🩸 Was it worth it?'}
            </button>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
