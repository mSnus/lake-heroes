import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
import { say } from '../utils/say';
import { PlayerCard } from './PlayerCard';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { DiceWidget, DiceWidgetDouble } from './DiceWidget';
import { resolveAmbush, AmbushOutcome } from '../actions/battles/resolveAmbush';
import { BRAWL_THRESHOLD } from '../game/constants';
import { computeBrawlRound } from '../actions/battles/common';
import '../styles/BattleScreen.css';

type Phase = 'attacker-roll' | 'defender-roll' | 'animating' | 'result';

interface AmbushScreenProps {
  player: Player;
  attackerUnits: number;
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
  onClose: () => void;
}

const ATTACKER_IMG = 'assets/figures/npc-saracen.png';

export const AmbushScreen: React.FC<AmbushScreenProps> = ({
  player,
  attackerUnits,
  gameState,
  updateGameState,
  onClose,
}) => {
  const doubleDice = attackerUnits > 12;
  const isBrawl = attackerUnits <= BRAWL_THRESHOLD;

  // ── State ──
  const [phase, setPhase] = useState<Phase>('attacker-roll');
  const [rollingAttacker, setRollingAttacker] = useState(false);
  const [rollingDefender, setRollingDefender] = useState(false);
  const [displayedAtkKilled, setDisplayedAtkKilled] = useState(0);
  const [displayedDefKilled, setDisplayedDefKilled] = useState(0);
  const [pendingAtkRoll, setPendingAtkRoll] = useState<number | null>(null);
  const [lastDefRoll, setLastDefRoll] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<AmbushOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);
  const [atkRollKey, setAtkRollKey] = useState(0);
  const [defRollKey, setDefRollKey] = useState(0);

  // ── Refs ──
  const atkUnitsLeftRef = useRef(attackerUnits);
  const defUnitsLeftRef = useRef(attackerUnits);
  const totalAtkKilledRef = useRef(0); // ambushers killed by player
  const totalDefKilledRef = useRef(0); // player units killed by ambushers
  const pendingAtkRollRef = useRef(0);

  // ── Initial log ──
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    say(`${player.name} is ambushed! ${attackerUnits}🥷 attack from the cover`, 'warning');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ambushers auto-roll first ──
  useEffect(() => {
    if (phase !== 'attacker-roll') return;
    const t = setTimeout(() => {
      setAtkRollKey((k) => k + 1);
      setRollingAttacker(true);
    }, 600);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Kill animation: defender column first (attacker's kills), then attacker column ──
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

  const onAttackerRollDone = (roll: number) => {
    pendingAtkRollRef.current = roll;
    setRollingAttacker(false);
    setPendingAtkRoll(roll);
    setPhase('defender-roll');
  };

  const handleDefenderRoll = () => {
    setDefRollKey((k) => k + 1);
    setRollingDefender(true);
  };

  const onDefenderRollDone = (roll: number) => {
    setRollingDefender(false);
    setLastDefRoll(roll);
    setPhase('animating');

    const aRoll = pendingAtkRollRef.current;
    // In ambush: attacker = saracen (left), defender = player (right)
    // aRoll kills player units (def column), roll kills saracen units (atk column)

    let defKills: number, atkKills: number, newDefLeft: number, newAtkLeft: number;
    if (isBrawl) {
      ({ defKills, atkKills, newDefLeft, newAtkLeft } = computeBrawlRound(
        aRoll, roll, attackerUnits, defUnitsLeftRef.current, atkUnitsLeftRef.current
      ));
    } else {
      defKills = Math.min(aRoll, defUnitsLeftRef.current);
      atkKills = Math.min(roll, atkUnitsLeftRef.current);
      newDefLeft = defUnitsLeftRef.current - defKills;
      newAtkLeft = atkUnitsLeftRef.current - atkKills;
    }
    // Brawl kills are visual only — no actual unit loss applied to players
    const resolveAtkKilled = isBrawl ? 0 : atkKills;
    const resolveDefKilled = isBrawl ? 0 : defKills;
    const newTotalAtkKilled = totalAtkKilledRef.current + resolveAtkKilled; // ambushers killed
    const newTotalDefKilled = totalDefKilledRef.current + resolveDefKilled; // player units killed

    animateKills(defKills, atkKills, () => {
      atkUnitsLeftRef.current = newAtkLeft;
      defUnitsLeftRef.current = newDefLeft;
      totalAtkKilledRef.current = newTotalAtkKilled;
      totalDefKilledRef.current = newTotalDefKilled;

      if (isBrawl || newDefLeft <= 0 || newAtkLeft <= 0) {
        // Outcome from player's perspective: player wins if ambushers are wiped
        const battleOutcome: AmbushOutcome =
          newAtkLeft <= 0 && newDefLeft > 0
            ? 'win'
            : newDefLeft <= 0 && newAtkLeft > 0
              ? 'defeat'
              : 'tie';

        setTimeout(() => {
          const res = resolveAmbush(
            gameState,
            player,
            attackerUnits,
            newTotalDefKilled,  // player units killed by ambushers
            newTotalAtkKilled,  // ambusher units killed by player
            battleOutcome
          );
          setOutcome(res.outcome);
          if (res.outcome === 'win') setShowVictoryBg(true);
          else setShowLostBg(true);
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
    onClose();
  };

  // ── Unit grid ──
  // Attacker (saracen, left): killed at right end (inner side)
  const attackerGrid = Array.from({ length: attackerUnits }, (_, i) =>
    i >= attackerUnits - displayedAtkKilled ? '💥' : '🧍'
  );
  // Defender (player, right): killed at left end (inner side)
  const defenderGrid = Array.from({ length: attackerUnits }, (_, i) =>
    i < displayedDefKilled ? '💥' : '🧍'
  );

  const resultEmoji = outcome === 'win' ? '🛡️' : outcome === 'defeat' ? '☠️' : '⚔️';

  return (
    <ScreenBackground image="assets/screens/caravan.jpg">
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
        <div className="battle-header">Ambush</div>
        {isBrawl && <div className="battle-brawl-tag">Brawl!</div>}

        <div className="battle-names-row">
          <div className="bc-attacker">
            <PlayerCard imageSrc={ATTACKER_IMG} name="Ambushers" color="#f6b03e" prefix="⚔️" />
          </div>
          <div className="bc-defender">
            <PlayerCard player={player} prefix="🛡️" />
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

        {phase === 'defender-roll' && !rollingDefender && (
          <button className="game-menu-button battle-roll-btn" onClick={handleDefenderRoll}>
            🛡️ Defend!
          </button>
        )}

        {phase === 'result' && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">
              {resultEmoji}
              <br />
              <span className="battle-result-verdict">
                {outcome === 'win'
                  ? 'The ambush is repelled!'
                  : outcome === 'defeat'
                    ? 'Overwhelmed!'
                    : 'A bloody stalemate!'}
              </span>
            </div>
            <p className="battle-result-message">{resultMsg}</p>
            <button className="game-menu-button" onClick={handleClose}>
              🧭 Ride on
            </button>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
