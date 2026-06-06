import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { say } from '../utils/say';
import { changeFame } from '../utils/fame';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { DiceWidget } from './DiceWidget';
import '../styles/BattleScreen.css';

type BattlePhase = 'attacker-roll' | 'defender-roll' | 'result';
type BattleOutcome = 'attacker' | 'defender' | 'tie';

type RoundResult = {
  attackerRoll: number;
  defenderRoll: number;
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

function roundCount(defence: number): number {
  return Math.max(1, Math.ceil(defence / 6));
}

function determineBattleOutcome(results: RoundResult[]): BattleOutcome {
  const aWins = results.filter((r) => r.winner === 'attacker').length;
  const dWins = results.filter((r) => r.winner === 'defender').length;
  if (aWins > dWins) return 'attacker';
  if (dWins > aWins) return 'defender';
  return 'tie';
}

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
  const totalRounds = isDragon ? 7 : roundCount(defence);

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
    say(
      `⚔️ ${attacker.name} attacks ${defenderLabel} for ${goal}, ${attacker.units}🧍 vs ${defence}🧍!`,
      'info'
    );
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
        const o = determineBattleOutcome(newResults);
        let msg = '';
        const unitsBefore = attacker.units;
        const goldBefore = attacker.gold;

        if (isDragon) {
          if (o === 'attacker') {
            gameState.gameMessage = `${attacker.name} slays the Dragon! 🐉 VICTORY!`;
            gameState.gameOver = true;
            msg = 'The Dragon is slain! 🐉 VICTORY!';
            setShowVictoryBg(true);
            setOutcome('attacker');
          } else if (o === 'tie') {
            const unitsPerRound = Math.max(1, Math.round(defence / totalRounds));
            const roundsLost = newResults.filter((r) => r.winner === 'defender').length;
            const unitLoss = roundsLost * unitsPerRound;
            const goldLoss = Math.floor(attacker.gold / 2);
            attacker.gold = Math.max(0, attacker.gold - goldLoss);
            if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
            const lossStr = unitLoss > 0 ? ` and ${unitLoss}🧍` : '';
            gameState.gameMessage = `${attacker.name} fought the Dragon to a draw, losing ${goldLoss}🟡${lossStr}`;
            msg = `The Dragon retreats. Lost ${goldLoss}🟡${lossStr}`;
            setShowLostBg(true);
            setOutcome('tie');
          } else {
            const unitLoss = Math.ceil(attacker.units / 2);
            const goldLoss = attacker.gold;
            attacker.units = Math.max(0, attacker.units - unitLoss);
            attacker.gold = 0;
            gameState.gameMessage = `${attacker.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍`;
            msg = `Lost all gold and ${unitLoss}🧍`;
            setShowLostBg(true);
            setOutcome('defender');
          }
        } else if (isCaravan) {
          if (o === 'attacker') {
            if (caravanSlaves) {
              attacker.units += caravanPrize!;
              gameState.gameMessage = `${attacker.name} freed ${caravanPrize}🧍 from the slavers!`;
              msg = `3 ${caravanPrize}🧍 freed from the slavers join your army!`;
            } else {
              attacker.gold += caravanPrize!;
              gameState.gameMessage = `${attacker.name} raided the caravan and pillaged ${caravanPrize}🟡!`;
              msg = `Pillaged ${caravanPrize}🟡`;
            }

            setShowVictoryBg(true);
            setOutcome('attacker');
          } else if (o === 'tie') {
            const halfPrize = Math.floor(caravanPrize! / 2);
            if (caravanSlaves) {
              attacker.units += halfPrize;
              gameState.gameMessage = `${attacker.name} freed ${halfPrize}🧍 from the caravan`;
              msg = `Freed ${halfPrize}🧍`;
            } else {
              attacker.gold += halfPrize;
              gameState.gameMessage = `${attacker.name} tied with the caravan guards, receiving ${halfPrize}🟡`;
              msg = `Received ${halfPrize}🟡`;
            }

            setOutcome('tie');
          } else {
            gameState.gameMessage = `${attacker.name} failed to raid the caravan`;
            msg = `The caravan got away`;
            setOutcome('defender');
          }
        } else {
          const unitsPerRound = Math.max(1, Math.round(defence / totalRounds));
          const roundsLost = newResults.filter((r) => r.winner === 'defender').length;
          const unitLoss = roundsLost * unitsPerRound;
          if (unitLoss > 0) attacker.units = Math.max(0, attacker.units - unitLoss);
          const lossStr = unitLoss > 0 ? `, losing ${unitLoss}🧍` : '';

          if (o === 'attacker') {
            const prevOwner = gameState.players.find((p) => p.name === tile!.owner);
            if (prevOwner) changeFame(prevOwner, -1);
            gameState.players.forEach((p) => {
              p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
            });
            tile!.owner = attacker.name;
            tile!._level = 1;
            attacker.ownedTiles.push(attacker.position);
            changeFame(attacker, 1);
            gameState.gameMessage = `Glorious victory! ${attacker.name} conquered ${tile!.name}${lossStr}!`;
            msg = `${attacker.name} wins ${tile!.name}${lossStr}! ${defender?.name} finds out that the tiles should be upgraded for better defence`;
            setShowVictoryBg(true);
            setOutcome('attacker');
          } else if (o === 'defender') {
            changeFame(attacker, -1);
            gameState.gameMessage = `${attacker.name} lost the battle for ${tile!.name}${lossStr}`;
            msg = `${attacker.name} retreats from ${tile!.name}${lossStr}`;
            setOutcome('defender');
          } else {
            msg = `${attacker.name}'s army retreats${lossStr}`;
            gameState.gameMessage = msg;
            if (unitLoss > 0) setShowLostBg(true);
            setOutcome('tie');
          }
        }

        // Single summary log entry
        const outcomeVerb =
          o === 'attacker' ? 'wins a battle' : o === 'defender' ? 'loses a battle' : 'ties';
        const capturePart = o === 'attacker' && tile ? `, captured ${tile.name}` : '';
        const unitsAfter = attacker.units;
        const goldAfter = attacker.gold;
        const unitDiff = unitsBefore - unitsAfter;
        const goldDiff = goldAfter - goldBefore;
        const unitsPart =
          unitDiff > 0
            ? `, lost ${unitDiff}🧍 (${unitsBefore}→${unitsAfter})`
            : unitDiff < 0
              ? `, gained ${-unitDiff}🧍 (${unitsBefore}→${unitsAfter})`
              : '';
        const goldPart =
          goldDiff > 0
            ? `, gained ${goldDiff}🟡`
            : goldDiff < 0
              ? `, lost ${-goldDiff}🟡 (${goldBefore}→${goldAfter})`
              : '';
        const logLevel = o === 'attacker' ? 'success' : o === 'defender' ? 'error' : 'info';
        say(
          `⚔️ ${attacker.name} ${outcomeVerb} with ${defenderLabel}${capturePart}${unitsPart}${goldPart}`,
          logLevel
        );

        markScreenResolved();
        updateGameState(gameState);
        setResultMsg(msg);
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

  // Per-round icons: winner keeps 🧍🏻, loser gets 💥, tie gets 🏴
  const attackerRoundIcon = (r: RoundResult) =>
    r.winner === 'attacker' ? '🧍🏻' : r.winner === 'defender' ? '💥' : '💥';
  const defenderRoundIcon = (r: RoundResult) =>
    r.winner === 'defender' ? '🧍🏻' : r.winner === 'attacker' ? '💥' : '💥';

  const battleResultEmoji = outcome === 'attacker' ? '⚔️' : outcome === 'defender' ? '☠️' : '🏴';

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
          {isCaravan ? 'Caravan raid!' : isDragon ? 'Dragon Attack' : <>Battle for{tile!.name}</>}
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
                {r.winner === 'attacker' ? '⚔️' : r.winner === 'tie' ? '🏴' : '☠️'}
              </div>
              <div className="bc-roll bc-roll-defender">{r.defenderRoll} 🎲</div>
              <div className="bc-side bc-defender">
                <span className="battle-round-icon">{defenderRoundIcon(r)}</span>
              </div>
            </div>
          ))}

          {/* Current round action row */}
          {phase !== 'result' && (
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
                    ? `The battle is lost!`
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
