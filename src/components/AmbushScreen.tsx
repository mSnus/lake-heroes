import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
import { say } from '../utils/say';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { DiceWidget } from './DiceWidget';
import { resolveAmbush } from '../actions/battles/resolveAmbush';
import { RoundResult, roundCount } from '../actions/battles/common';
import '../styles/BattleScreen.css';

type Phase = 'attacker-roll' | 'defender-roll' | 'result';

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
  const totalRounds = roundCount(attackerUnits);

  const [currentRound, setCurrentRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('attacker-roll');
  const [rollingAttacker, setRollingAttacker] = useState(false);
  const [rollingDefender, setRollingDefender] = useState(false);
  const [pendingAttackerRoll, setPendingAttackerRoll] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<'win' | 'defeat' | 'tie' | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);

  const roundResultsRef = useRef<RoundResult[]>([]);
  const currentRoundRef = useRef(0);
  const attackerRollRef = useRef(0);

  const loggedStartRef = useRef(false);
  useEffect(() => {
    if (loggedStartRef.current) return;
    loggedStartRef.current = true;
    say(`${player.name} is ambushed! ${attackerUnits}🧍 attack from the cover`, 'warning');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The ambushers (attacker) always roll first, automatically.
  useEffect(() => {
    if (phase !== 'attacker-roll') return;
    const t = setTimeout(() => setRollingAttacker(true), 600);
    return () => clearTimeout(t);
  }, [phase]);

  const handleDefenderRoll = () => setRollingDefender(true);

  const onAttackerRollDone = (roll: number) => {
    attackerRollRef.current = roll;
    setRollingAttacker(false);
    setPendingAttackerRoll(roll);
    setPhase('defender-roll');
  };

  const onDefenderRollDone = (roll: number) => {
    setRollingDefender(false);

    const roundIdx = currentRoundRef.current;
    const aRoll = attackerRollRef.current;

    const result: RoundResult = {
      attackerRoll: aRoll,
      defenderRoll: roll,
      winner: aRoll > roll ? 'attacker' : roll > aRoll ? 'defender' : 'tie',
    };

    const newResults = [...roundResultsRef.current, result];
    roundResultsRef.current = newResults;
    setRoundResults(newResults);
    setPendingAttackerRoll(null);

    const nextRound = roundIdx + 1;

    if (nextRound < totalRounds) {
      currentRoundRef.current = nextRound;
      setCurrentRound(nextRound);
      setPhase('attacker-roll');
    } else {
      setTimeout(() => {
        const res = resolveAmbush(gameState, player, attackerUnits, totalRounds, newResults);
        setOutcome(res.outcome);
        if (res.outcome === 'win') setShowVictoryBg(true);
        else setShowLostBg(true);

        markScreenResolved();
        updateGameState(gameState);
        setResultMsg(res.message);
        setPhase('result');
      }, 500);
    }
  };

  const handleClose = () => {
    clearScreen();
    onClose();
  };

  const playerImg = getPlayerImageSrc(player.image, player.fame);

  // Winner of a round keeps their figure 🧍🏻, loser shows 💥.
  const attackerRoundIcon = (r: RoundResult) => (r.winner === 'defender' ? '💥' : '🧍🏻');
  const defenderRoundIcon = (r: RoundResult) => (r.winner === 'attacker' ? '💥' : '🧍🏻');

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

      {rollingAttacker && (
        <DiceWidget key={`a-${currentRound}`} rolling={true} onRoll={onAttackerRollDone} />
      )}
      {rollingDefender && (
        <DiceWidget key={`d-${currentRound}`} rolling={true} onRoll={onDefenderRollDone} />
      )}

      <div className="battle-screen">
        <div className="battle-header">Ambush</div>
        <div className="battle-total-rounds">{totalRounds > 1 ? `${totalRounds} rounds` : ''}</div>

        <div className="battle-names-row">
          <div className="bc-attacker">
            <img src={ATTACKER_IMG} alt="Ambushers" className="battle-player-icon" />
            <br />
            <span className="battle-player-name" style={{ color: '#f6b03e' }}>
              ⚔️ Ambushers
            </span>
          </div>
          <div className="bc-defender">
            <img src={playerImg} alt={player.name} className="battle-player-icon" />
            <br />
            <span className="battle-player-name" style={{ color: player.color }}>
              🛡️ {player.name}
            </span>
          </div>
        </div>

        <div className="battle-table">
          {roundResults.map((r, i) => (
            <div key={i} className="battle-result-row">
              <div className="bc-side bc-attacker">
                <span className="battle-round-icon">{attackerRoundIcon(r)}</span>
              </div>
              <div className="bc-roll bc-roll-attacker">🎲 {r.attackerRoll}</div>
              <div className="battle-round-result">
                <div className="battle-round-result-icon">
                  <div>{r.winner === 'defender' ? '🛡️' : r.winner === 'tie' ? '⚔️' : '☠️'}</div>
                  <div
                    style={{
                      color:
                        r.winner === 'defender'
                          ? player.color
                          : r.winner === 'attacker'
                            ? '#f6b03e'
                            : 'white',
                    }}
                  >
                    {r.winner === 'defender' ? 'repelled' : r.winner === 'tie' ? 'victory' : 'defeated'}
                  </div>
                </div>
              </div>
              <div className="bc-roll bc-roll-defender">{r.defenderRoll} 🎲</div>
              <div className="bc-side bc-defender">
                <span className="battle-round-icon">{defenderRoundIcon(r)}</span>
              </div>
            </div>
          ))}

          {phase !== 'result' && roundResults.length < totalRounds && (
            <div className="battle-action-row">
              <div className="bc-side bc-attacker">
                {phase === 'defender-roll' && <span className="battle-round-icon">🧍🏻</span>}
              </div>
              <div className="bc-roll bc-roll-attacker">
                {phase === 'defender-roll' && pendingAttackerRoll !== null ? (
                  <>🎲 {pendingAttackerRoll}</>
                ) : (
                  <span className="dim">·</span>
                )}
              </div>
              <div className="bc-roll bc-roll-defender">
                <span className="dim">·</span>
              </div>
              <div className="bc-side bc-defender">
                {phase === 'defender-roll' && !rollingDefender && (
                  <button className="game-menu-button battle-roll-btn" onClick={handleDefenderRoll}>
                    🛡️ Defend!
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

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
