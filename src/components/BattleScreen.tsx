import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { showDice } from '../utils/diceStore';
import { say } from '../utils/say';
import { playerImageAssets } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import '../styles/BattleScreen.css';

type BattlePhase = 'attacker-roll' | 'defender-roll' | 'result';
type BattleOutcome = 'attacker' | 'defender' | 'tie';

type RoundResult = {
  soldiers: number;
  attackerRoll: number;
  defenderRoll: number;
  attackerKills: number;
  defenderKills: number;
  winner: 'attacker' | 'defender' | 'tie';
};

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

const KILL_PCT: Record<number, number> = { 1: 0, 2: 0.2, 3: 0.3, 4: 0.5, 5: 0.7, 6: 1.0 };

function rollKills(roll: number, soldiers: number): number {
  return Math.round((KILL_PCT[roll] ?? 0) * soldiers);
}

function buildRoundSoldiers(defence: number): number[] {
  const rounds: number[] = [];
  let rem = defence;
  while (rem > 0) {
    rounds.push(Math.min(6, rem));
    rem -= 6;
  }
  return rounds.length > 0 ? rounds : [1];
}

function determineBattleOutcome(results: RoundResult[]): BattleOutcome {
  const aWins = results.filter((r) => r.winner === 'attacker').length;
  const dWins = results.filter((r) => r.winner === 'defender').length;
  if (aWins > dWins) return 'attacker';
  if (dWins > aWins) return 'defender';
  const aKills = results.reduce((s, r) => s + r.attackerKills, 0);
  const dKills = results.reduce((s, r) => s + r.defenderKills, 0);
  if (aKills > dKills) return 'attacker';
  if (dKills > aKills) return 'defender';
  return 'tie';
}

const DRAGON_UNITS = 50;
const ANIM_INTERVAL_MS = 80;
const ANIM_DURATION_MS = 700;

export const BattleScreen: React.FC<BattleScreenProps> = (props) => {
  const { attacker, gameState, updateGameState } = props;
  const isCaravan = props.mode === 'caravan';
  const isDragon = props.mode === 'dragon';
  const defender = !isCaravan && !isDragon ? props.defender : undefined;
  const tile = !isCaravan && !isDragon ? props.tile : undefined;
  const caravanDefence = isCaravan ? props.caravanDefence : undefined;
  const caravanPrize = isCaravan ? props.caravanPrize : undefined;

  const defence = isCaravan
    ? (caravanDefence ?? 1)
    : isDragon
      ? DRAGON_UNITS
      : (tile?.defence ?? 1);
  const roundSoldiers = buildRoundSoldiers(defence);
  const totalRounds = roundSoldiers.length;

  const [currentRound, setCurrentRound] = useState(0);
  const [phase, setPhase] = useState<BattlePhase>('attacker-roll');
  const [pendingAttackerRoll, setPendingAttackerRoll] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [showLostBg, setShowLostBg] = useState(false);
  const [showVictoryBg, setShowVictoryBg] = useState(false);

  const [animatingAttacker, setAnimatingAttacker] = useState(false);
  const [animatingDefender, setAnimatingDefender] = useState(false);
  const [animAttackerVal, setAnimAttackerVal] = useState(1);
  const [animDefenderVal, setAnimDefenderVal] = useState(1);

  const roundResultsRef = useRef<RoundResult[]>([]);
  const currentRoundRef = useRef(0);
  const attackerRollRef = useRef(0);
  const attackerKillsRef = useRef(0);
  const attackerAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const defenderAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (attackerAnimRef.current) clearInterval(attackerAnimRef.current);
      if (defenderAnimRef.current) clearInterval(defenderAnimRef.current);
    };
  }, []);

  // Auto-roll defender in caravan/dragon mode
  useEffect(() => {
    if (phase !== 'defender-roll' || (!isCaravan && !isDragon)) return;
    const t = setTimeout(() => handleDefenderRoll(), 600);
    return () => clearTimeout(t);
  }, [phase, isCaravan, isDragon]);

  const handleAttackerRoll = () => {
    const soldiers = roundSoldiers[currentRoundRef.current];
    const roll = rollDice();
    const aKills = rollKills(roll, soldiers);
    attackerRollRef.current = roll;
    attackerKillsRef.current = aKills;

    setAnimatingAttacker(true);
    attackerAnimRef.current = setInterval(() => setAnimAttackerVal(rollDice()), ANIM_INTERVAL_MS);
    setTimeout(() => {
      clearInterval(attackerAnimRef.current!);
      setAnimatingAttacker(false);
      setPendingAttackerRoll(roll);
      setPhase('defender-roll');
    }, ANIM_DURATION_MS);
  };

  const handleDefenderRoll = () => {
    const roundIdx = currentRoundRef.current;
    const soldiers = roundSoldiers[roundIdx];
    const roll = rollDice();
    const dKills = rollKills(roll, soldiers);

    setAnimatingDefender(true);
    defenderAnimRef.current = setInterval(() => setAnimDefenderVal(rollDice()), ANIM_INTERVAL_MS);
    setTimeout(() => {
      clearInterval(defenderAnimRef.current!);
      setAnimatingDefender(false);

      const aRoll = attackerRollRef.current;
      const aKills = attackerKillsRef.current;

      const result: RoundResult = {
        soldiers,
        attackerRoll: aRoll,
        defenderRoll: roll,
        attackerKills: aKills,
        defenderKills: dKills,
        winner: aKills > dKills ? 'attacker' : dKills > aKills ? 'defender' : 'tie',
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
        // All rounds done — compute outcome
        const o = determineBattleOutcome(newResults);
        const totalAttDead = newResults.reduce((s, r) => s + r.defenderKills, 0);
        let msg = '';

        if (isDragon) {
          if (o !== 'defender') {
            gameState.gameMessage = `${attacker.name} slays the Dragon! 🐉 VICTORY!`;
            gameState.gameOver = true;
            say(`${attacker.name} slays the Dragon and wins the game! 🎉`, 'success');
            msg = 'The Dragon is slain! 🐉 VICTORY!';
            setShowVictoryBg(true);
            setOutcome('attacker');
          } else {
            const unitLoss = Math.ceil(attacker.units / 2);
            const goldLoss = attacker.gold;
            attacker.units = Math.max(0, attacker.units - unitLoss);
            attacker.gold = 0;
            gameState.gameMessage = `${attacker.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍`;
            say(`${attacker.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍.`, 'error');
            msg = `Lost all gold and ${unitLoss}🧍`;
            setOutcome('defender');
          }
        } else if (isCaravan) {
          if (o === 'attacker') {
            attacker.gold += caravanPrize!;
            gameState.gameMessage = `${attacker.name} raided the caravan and received ${caravanPrize}🟡!`;
            say(`${attacker.name} raided the caravan and received ${caravanPrize}🟡!`, 'success');
            msg = `Received ${caravanPrize}🟡`;
            setShowVictoryBg(true);
            setOutcome('attacker');
          } else if (o === 'tie') {
            const halfPrize = Math.floor(caravanPrize! / 2);
            attacker.units = Math.max(0, attacker.units - totalAttDead);
            attacker.gold += halfPrize;
            gameState.gameMessage = `${attacker.name} tied with the caravan guards, losing ${totalAttDead}🧍 but receiving ${halfPrize}🟡`;
            say(`${attacker.name} tied with caravan guards, losing ${totalAttDead}🧍 but receiving ${halfPrize}🟡`, 'info');
            msg = `Lost ${totalAttDead}🧍, received ${halfPrize}🟡`;
            setOutcome('tie');
          } else {
            attacker.units = Math.max(0, attacker.units - totalAttDead);
            gameState.gameMessage = `${attacker.name} failed to raid the caravan, losing ${totalAttDead}🧍`;
            say(`${attacker.name} failed to raid the caravan, losing ${totalAttDead}🧍`, 'error');
            msg = `Lost ${totalAttDead}🧍`;
            setOutcome('defender');
          }
        } else {
          // Tile battle
          if (o === 'attacker') {
            attacker.units = Math.max(0, attacker.units - totalAttDead);
            const prevOwner = gameState.players.find((p) => p.name === tile!.owner);
            if (prevOwner) prevOwner.fame = Math.max(1, prevOwner.fame - 1);
            gameState.players.forEach((p) => {
              p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
            });
            tile!.owner = attacker.name;
            tile!._level = 1;
            attacker.ownedTiles.push(attacker.position);
            attacker.fame++;
            gameState.gameMessage = `Glorious victory! ${attacker.name} won ${tile!.name} sacrificing ${totalAttDead}🧍`;
            say(`${attacker.name} won ${tile!.name} sacrificing ${totalAttDead}🧍`, 'success');
            msg = `Glorious victory! ${attacker.name} wins ${tile!.name} sacrificing ${totalAttDead}🧍`;
            setShowVictoryBg(true);
            setOutcome('attacker');
          } else if (o === 'defender') {
            attacker.units = Math.max(0, attacker.units - totalAttDead);
            attacker.fame = Math.max(1, attacker.fame - 1);
            gameState.gameMessage = `${attacker.name} lost ${totalAttDead}🧍 in the battle for ${tile!.name}`;
            say(`${attacker.name} lost ${totalAttDead}🧍 in the battle for ${tile!.name}`, 'error');
            msg = `${attacker.name} loses ${totalAttDead}🧍 in the battle for ${tile!.name}`;
            setOutcome('defender');
          } else {
            // Tie: 20% unit loss, tile unchanged, fame unchanged
            const tieLoss = Math.round(0.2 * attacker.units);
            attacker.units = Math.max(0, attacker.units - tieLoss);
            const tieSuffix = tieLoss > 0 ? `, ${tieLoss}🧍 are lost` : '';
            msg = `A tie! Receiving many wounds, ${attacker.name}'s army flee${tieSuffix}`;
            gameState.gameMessage = msg;
            say(msg, 'info');
            if (tieLoss > 0) setShowLostBg(true);
            setOutcome('tie');
          }
        }

        markScreenResolved();
        updateGameState(gameState);
        setResultMsg(msg);
        setPhase('result');
      }
    }, ANIM_DURATION_MS);
  };

  const handleClose = () => {
    clearScreen();
    if (isCaravan) {
      (props as { onClose: () => void }).onClose();
    } else if (isDragon) {
      if (outcome !== 'attacker') showDice();
    } else {
      setEndTurn();
    }
  };

  const attackerImg = playerImageAssets[attacker.image];
  const defenderImg = defender ? playerImageAssets[defender.image] : null;

  const roundSequenceEmoji = roundResults
    .map((r) => (r.winner === 'attacker' ? '⚔️' : r.winner === 'defender' ? '☠️' : '🏴'))
    .join('');

  // Per-round cell helpers
  const attackerUnitIcon = (r: RoundResult) => (r.winner === 'defender' ? '💥' : '🧍🏻');
  const defenderUnitIcon = (r: RoundResult) => (r.winner === 'attacker' ? '💥' : '🧍🏻');

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
      <div className="battle-screen">
        <div className="battle-header">
          {isCaravan ? (
            '🐪 Caravan raid!'
          ) : isDragon ? (
            '🐉 Dragon Battle!'
          ) : (
            <>⚔️ Battle for <strong>{tile!.name}</strong></>
          )}
        </div>

        <div className="battle-table">
          {/* Attacker units row */}
          <div className="battle-row">
            <div className="battle-row-label">
              <img src={attackerImg} alt={attacker.name} className="battle-player-icon" />
              <span className="battle-player-name" style={{ color: attacker.color }}>
                {attacker.name}
              </span>
            </div>
            <div className="battle-row-cells">
              {Array.from({ length: totalRounds }, (_, i) => {
                const r = roundResults[i];
                return (
                  <span key={i} className="battle-cell unit-cell">
                    {r ? attackerUnitIcon(r) : '🧍🏻'}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Attacker rolls row */}
          <div className="battle-row roll-row">
            <div className="battle-row-label roll-label">🎲</div>
            <div className="battle-row-cells">
              {Array.from({ length: totalRounds }, (_, i) => {
                const r = roundResults[i];
                const isAnimating = i === currentRound && animatingAttacker;
                const isPending = i === currentRound && pendingAttackerRoll !== null && !r && !isAnimating;
                const roll = r ? r.attackerRoll : isAnimating ? animAttackerVal : isPending ? pendingAttackerRoll : null;
                return (
                  <span key={i} className={`battle-cell roll-cell${roll !== null ? '' : ' dim'}`}>
                    {roll !== null ? roll : '·'}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="battle-table-divider" />

          {/* Defender rolls row */}
          <div className="battle-row roll-row">
            <div className="battle-row-label roll-label">🎲</div>
            <div className="battle-row-cells">
              {Array.from({ length: totalRounds }, (_, i) => {
                const r = roundResults[i];
                const isAnimating = i === currentRound && animatingDefender;
                const roll = r ? r.defenderRoll : isAnimating ? animDefenderVal : null;
                return (
                  <span key={i} className={`battle-cell roll-cell${roll !== null ? '' : ' dim'}`}>
                    {roll !== null ? roll : '·'}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Defender units row */}
          <div className="battle-row">
            <div className="battle-row-label defender-label">
              {defenderImg ? (
                <img src={defenderImg} alt={defender!.name} className="battle-player-icon" />
              ) : (
                <span className="battle-emoji-icon">{isDragon ? '🐉' : '🐪'}</span>
              )}
              <span className="battle-player-name" style={{ color: defender?.color }}>
                {defender ? defender.name : isDragon ? 'Dragon' : 'Caravan'}
              </span>
            </div>
            <div className="battle-row-cells">
              {Array.from({ length: totalRounds }, (_, i) => {
                const r = roundResults[i];
                return (
                  <span key={i} className="battle-cell unit-cell">
                    {r ? defenderUnitIcon(r) : '🧍🏻'}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action prompts */}
        {phase === 'attacker-roll' && !animatingAttacker && (
          <div className="battle-action">
            <span className="battle-player-name" style={{ color: attacker.color }}>
              {attacker.name}
            </span>
            <button className="game-menu-button battle-roll-btn" onClick={handleAttackerRoll}>
              ⚔️ Attack!
            </button>
          </div>
        )}

        {phase === 'defender-roll' && !isCaravan && !isDragon && !animatingDefender && (
          <div className="battle-action">
            <span className="battle-player-name" style={{ color: defender!.color }}>
              {defender!.name}
            </span>
            <button className="game-menu-button battle-roll-btn" onClick={handleDefenderRoll}>
              🛡️ Defend!
            </button>
          </div>
        )}

        {/* Inline result */}
        {phase === 'result' && (
          <div className="battle-result-inline">
            <div className="battle-result-sequence">{roundSequenceEmoji}</div>
            <p className="battle-result-message">{resultMsg}</p>
            <button className="game-menu-button" onClick={handleClose}>
              Was it worth it?
            </button>
          </div>
        )}
      </div>
    </ScreenBackground>
  );
};
