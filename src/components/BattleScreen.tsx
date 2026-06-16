import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
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
    };

const DRAGON_UNITS = 50;

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const { attacker, gameState, updateGameState } = props;

  // ── Mode extraction (TypeScript narrowing per branch) ──
  const isCaravan = props.mode === 'caravan';
  const isDragon = props.mode === 'dragon';
  const isPlayerBattle = props.mode === 'player';
  const isTile = !isCaravan && !isDragon && !isPlayerBattle;
  const isAutoDefender = isCaravan || isDragon;

  let defence: number;
  let defender: Player | undefined;
  let tile: Tile | undefined;
  let caravanPrize: number | undefined;
  let caravanSlaves = false;
  let battlefieldUnits: number | undefined;

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
  } else {
    defence = props.tile?.defence ?? 1;
    defender = props.defender;
    tile = props.tile;
  }

  const doubleDice = defence > 12;
  const isBrawl = defence <= 5 && !isCaravan;

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
  const atkUnitsLeftRef = useRef(defence);
  const defUnitsLeftRef = useRef(defence);
  const totalAtkKilledRef = useRef(0);
  const totalDefKilledRef = useRef(0);
  const pendingAtkRollRef = useRef(0);

  // ── Labels ──
  const defenderLabel = isDragon
    ? 'The Dragon'
    : isCaravan
      ? 'Caravan Guards'
      : (defender?.name ?? 'Guards');
  const defenderColor = isDragon ? '#ff5816' : isCaravan ? '#f6b03e' : defender?.color;
  const defenderImg = isDragon
    ? 'assets/figures/npc-drac.png'
    : isCaravan
      ? 'assets/figures/npc-saracen.png'
      : defender
        ? getPlayerImageSrc(defender.image, defender.fame)
        : 'assets/figures/npc-saracen.png';

  // ── Initial log ──
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    const goal = isCaravan
      ? (caravanSlaves ? `${caravanPrize}🧍 in chains` : `${caravanPrize}🟡 of loot`)
      : isDragon
        ? 'the kingdom'
        : isPlayerBattle
          ? 'glory'
          : tile!.name;
    const defEmoji = isCaravan ? '🥷' : '🧍';
    say(`${attacker.name} attacks ${defenderLabel}'s ${defence}${defEmoji} for ${goal}`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          { prize: caravanPrize!, slaves: caravanSlaves },
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
    setPhase('defender-roll');
  };

  const onDefenderRollDone = (roll: number) => {
    setRollingDefender(false);
    setLastDefRoll(roll);
    setPhase('animating');

    const aRoll = pendingAtkRollRef.current;

    // Brawl (≤6 units): 1 round, higher roll wins, loser loses all
    let defKills: number;
    let atkKills: number;
    let newDefLeft: number;
    let newAtkLeft: number;

    if (isBrawl) {
      if (aRoll > roll) {
        defKills = defence; atkKills = 0;
        newDefLeft = 0; newAtkLeft = defence;
      } else if (roll > aRoll) {
        defKills = 0; atkKills = defence;
        newDefLeft = defence; newAtkLeft = 0;
      } else {
        defKills = 0; atkKills = 0;
        newDefLeft = 0; newAtkLeft = 0;
      }
    } else {
      defKills = Math.min(aRoll, defUnitsLeftRef.current);
      atkKills = Math.min(roll, atkUnitsLeftRef.current);
      newDefLeft = defUnitsLeftRef.current - defKills;
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

      if (newDefLeft <= 0 || newAtkLeft <= 0) {
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
    if (isCaravan) {
      (props as { onClose: () => void }).onClose();
    } else if (isDragon) {
      if (outcome !== 'attacker') setEndTurn();
    } else if (isPlayerBattle) {
      (props as { onClose: () => void }).onClose();
    } else {
      setEndTurn();
    }
  };

  // ── Unit grid: killed 💥 accumulate on the inner side (toward center) ──
  // Attacker column (left): killed appear at the right end
  const attackerGrid = Array.from({ length: defence }, (_, i) =>
    i >= defence - displayedAtkKilled ? '💥' : '🧍'
  );
  // Defender column (right): killed appear at the left end
  const defenderGrid = Array.from({ length: defence }, (_, i) =>
    i < displayedDefKilled ? '💥' : '🧍'
  );

  const battleResultEmoji =
    outcome === 'attacker' ? '⚔️' : outcome === 'defender' ? '☠️' : '🛡️';

  const headerText = isCaravan
    ? 'Caravan Raid!'
    : isDragon
      ? 'Dragon Battle'
      : isPlayerBattle
        ? "Hero's Hour"
        : isTile
          ? `Battle for ${tile!.name}`
          : 'Battle';

  return (
    <ScreenBackground image="assets/screens/battle.jpg">
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
            <PlayerCard player={attacker} prefix="⚔️" />
          </div>
          <div className="bc-defender">
            <PlayerCard
              imageSrc={defenderImg}
              name={defenderLabel}
              color={defenderColor}
              prefix="🛡️"
            />
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
            <span className="bf-sep">⚔️</span>
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

        {phase === 'attacker-roll' && !rollingAttacker && (
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
                {outcome === 'attacker'
                  ? 'Glorious victory!'
                  : outcome === 'defender'
                    ? 'Defeat!'
                    : 'A tie!'}
              </span>
            </div>
            <p className="battle-result-message">{resultMsg}</p>
            <button className="game-menu-button" onClick={handleClose}>
              🩸 Was it worth it?
            </button>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
