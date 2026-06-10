import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { say } from '../utils/say';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { DiceWidget } from './DiceWidget';
import { BattleOutcome, RoundResult, roundCount } from '../actions/battles/common';
import { resolveTileBattle } from '../actions/battles/resolveTileBattle';
import { resolveCaravanBattle } from '../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../actions/battles/resolveDragonBattle';
import '../styles/BattleScreen.css';

type BattlePhase = 'attacker-roll' | 'defender-roll' | 'result';

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
    };

const DRAGON_UNITS = 50;

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const { attacker, gameState, updateGameState } = props;
  const isCaravan = props.mode === 'caravan';
  const isDragon = props.mode === 'dragon';
  const defender = !isCaravan && !isDragon ? props.defender : undefined;
  const tile = !isCaravan && !isDragon ? props.tile : undefined;
  const caravanDefence = isCaravan ? props.caravanDefence : undefined;
  const caravanPrize = isCaravan ? props.caravanPrize : undefined;
  const caravanSlaves = isCaravan ? (props.caravanSlaves ?? false) : false;

  const defence = isCaravan
    ? (caravanDefence ?? 1)
    : isDragon
      ? DRAGON_UNITS
      : (tile?.defence ?? 1);
  const totalRounds = isDragon ? 5 : roundCount(defence);

  const [currentRound, setCurrentRound] = useState(0);
  const [phase, setPhase] = useState<BattlePhase>('attacker-roll');
  const [rollingAttacker, setRollingAttacker] = useState(false);
  const [rollingDefender, setRollingDefender] = useState(false);
  const [pendingAttackerRoll, setPendingAttackerRoll] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);

  const roundResultsRef = useRef<RoundResult[]>([]);
  const currentRoundRef = useRef(0);
  const attackerRollRef = useRef(0);

  const defenderLabel = defender ? defender.name : isDragon ? 'The Dragon' : 'Caravan Guards';
  const defenderColor = isDragon ? '#ff5816' : isCaravan ? '#f6b03e' : defender?.color;

  // Log the opening conditions of the battle once (ref guards against React
  // StrictMode's double mount in development).
  const loggedStartRef = useRef(false);
  useEffect(() => {
    if (loggedStartRef.current) return;
    loggedStartRef.current = true;
    const goal = isCaravan
      ? caravanSlaves
        ? `${caravanPrize}🧍 in chains`
        : `${caravanPrize}🟡 of loot`
      : isDragon
        ? 'the kingdom'
        : tile!.name;
    say(`${attacker.name} attacks ${defenderLabel}'s ${defence}🧍 for ${goal}`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-roll defender in caravan/dragon mode
  useEffect(() => {
    if (phase !== 'defender-roll' || (!isCaravan && !isDragon)) return;
    const t = setTimeout(() => setRollingDefender(true), 600);
    return () => clearTimeout(t);
  }, [phase, isCaravan, isDragon]);

  const handleAttackerRoll = () => setRollingAttacker(true);
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
      // Pause briefly on the final roll before revealing the result screen.
      setTimeout(() => {
        const res = isDragon
          ? resolveDragonBattle(gameState, attacker, defence, totalRounds, newResults)
          : isCaravan
            ? resolveCaravanBattle(
                gameState,
                attacker,
                { prize: caravanPrize!, slaves: caravanSlaves },
                defence,
                totalRounds,
                newResults
              )
            : resolveTileBattle(
                gameState,
                attacker,
                defender,
                tile!,
                defence,
                totalRounds,
                newResults
              );

        setOutcome(res.outcome);
        if (res.victoryBg) setShowVictoryBg(true);
        if (res.lostBg) setShowLostBg(true);

        markScreenResolved();
        updateGameState(gameState);
        setResultMsg(res.message);
        setPhase('result');
      }, 500);
    }
  };

  const handleClose = () => {
    clearScreen();
    if (isCaravan) {
      (props as { onClose: () => void }).onClose();
    } else if (isDragon) {
      if (outcome !== 'attacker') setEndTurn();
    } else {
      setEndTurn();
    }
  };

  const attackerImg = getPlayerImageSrc(attacker.image, attacker.fame);
  const defenderImg = defender
    ? getPlayerImageSrc(defender.image, defender.fame)
    : isDragon
      ? 'assets/figures/npc-drac.png'
      : 'assets/figures/npc-saracen.png';

  // Per-round icons: winner keeps 🧍🏻, loser gets 💥, tie gets 🛡️
  const attackerRoundIcon = (r: RoundResult) =>
    r.winner === 'attacker' ? '🧍🏻' : r.winner === 'defender' ? '💥' : '🧍🏻';
  const defenderRoundIcon = (r: RoundResult) =>
    r.winner === 'defender' ? '🧍🏻' : r.winner === 'attacker' ? '💥' : '🧍🏻';

  const battleResultEmoji = outcome === 'attacker' ? '⚔️' : outcome === 'defender' ? '☠️' : '🛡️';

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

      {rollingAttacker && (
        <DiceWidget key={`a-${currentRound}`} rolling={true} onRoll={onAttackerRollDone} />
      )}
      {rollingDefender && (
        <DiceWidget key={`d-${currentRound}`} rolling={true} onRoll={onDefenderRollDone} />
      )}

      <div className="battle-screen">
        <div className="battle-header">
          {isCaravan ? 'Caravan raid!' : isDragon ? 'Dragon Battle' : <>Battle for{tile!.name}</>}
        </div>
        <div className="battle-total-rounds">{totalRounds > 1 ? `${totalRounds} rounds` : ''}</div>

        <div className="battle-names-row">
          <div className="bc-attacker">
            <img src={attackerImg} alt={attacker.name} className="battle-player-icon" />
            <br />
            <span className="battle-player-name" style={{ color: attacker.color }}>
              ⚔️ {attacker.name}
            </span>
          </div>
          <div className="bc-defender">
            <img src={defenderImg} alt={defenderLabel} className="battle-player-icon" />
            <br />
            <span className="battle-player-name" style={{ color: defenderColor }}>
              🛡️ {defenderLabel}
            </span>
          </div>
        </div>

        <div className="battle-table">
          {/* Completed round rows */}
          {roundResults.map((r, i) => (
            <div key={i} className="battle-result-row">
              <div className="bc-side bc-attacker">
                <span className="battle-round-icon">{attackerRoundIcon(r)}</span>
              </div>
              <div className="bc-roll bc-roll-attacker">🎲 {r.attackerRoll}</div>
              <div className="battle-round-result">
                <div className="battle-round-result-icon">
                  <div>{r.winner === 'attacker' ? '⚔️' : r.winner === 'tie' ? '🛡️' : '☠️'}</div>
                  <div
                    style={{
                      color:
                        r.winner === 'attacker'
                          ? attacker.color
                          : r.winner === 'defender'
                            ? defenderColor
                            : 'white',
                    }}
                  >
                    {r.winner === 'attacker' ? 'victory' : r.winner === 'tie' ? 'tie' : 'loss'}
                  </div>
                </div>
              </div>
              <div className="bc-roll bc-roll-defender">{r.defenderRoll} 🎲</div>
              <div className="bc-side bc-defender">
                <span className="battle-round-icon">{defenderRoundIcon(r)}</span>
              </div>
            </div>
          ))}

          {/* Current round action row (hidden during the pause after the last round) */}
          {phase !== 'result' && roundResults.length < totalRounds && (
            <div className="battle-action-row">
              <div className="bc-side bc-attacker">
                {phase === 'attacker-roll' && !rollingAttacker && (
                  <button className="game-menu-button battle-roll-btn" onClick={handleAttackerRoll}>
                    ⚔️ Attack!
                  </button>
                )}
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
                {phase === 'defender-roll' && !isCaravan && !isDragon && !rollingDefender && (
                  <button className="game-menu-button battle-roll-btn" onClick={handleDefenderRoll}>
                    🛡️ Defend!
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        {phase === 'result' && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">
              {battleResultEmoji}
              <br />
              <span className="battle-result-verdict">
                {outcome === 'attacker'
                  ? `Glorious victory!`
                  : outcome === 'defender'
                    ? `Defeat!`
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
