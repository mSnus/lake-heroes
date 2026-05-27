import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { rollDice } from '../game/Dice';
import { clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { showDice } from '../utils/diceStore';
import { say } from '../utils/say';
import { playerImageAssets } from '../game/PlayerOptions';
import { ScreenBackground } from './ScreenBackground';
import '../styles/BattleScreen.css';
import { Fade } from './Fade';

type BattlePhase = 'revealing' | 'attacker-roll' | 'defender-roll' | 'deaths' | 'result';
type BattleOutcome = 'attacker' | 'defender' | 'raze';

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
      // Tile battle (default)
      mode?: 'tile';
      defender?: Player;
      tile?: Tile;
      onClose?: never;
    }
  | {
      attacker: Player;
      gameState: GameState;
      updateGameState: (gs: GameState) => void;
      // Caravan battle
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
      // Dragon battle (50 vs 50)
      mode: 'dragon';
      defender?: never;
      tile?: never;
      onClose?: never;
    };

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
  return 'raze';
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

  const defence = isCaravan
    ? (caravanDefence ?? 1)
    : isDragon
      ? DRAGON_UNITS
      : (tile?.defence ?? 1);
  const roundSoldiers = buildRoundSoldiers(defence);
  const totalRounds = roundSoldiers.length;

  const [currentRound, setCurrentRound] = useState(0);
  const [phase, setPhase] = useState<BattlePhase>('revealing');
  const [revealCount, setRevealCount] = useState(0);
  const [attackerRoll, setAttackerRoll] = useState<number | null>(null);
  const [defenderRoll, setDefenderRoll] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [resultMsg, setResultMsg] = useState('');

  // Refs to avoid stale closures in setTimeout callbacks
  const roundResultsRef = useRef<RoundResult[]>([]);
  const roundDataRef = useRef({
    soldiers: 0,
    attackerRoll: 0,
    defenderRoll: 0,
    attackerKills: 0,
    defenderKills: 0,
  });
  const currentRoundRef = useRef(0);

  const soldiers = roundSoldiers[currentRound] ?? 1;

  // Derived kill counts (stable during deaths phase via roundDataRef)
  const attackerKills = roundDataRef.current.attackerKills;
  const defenderKills = roundDataRef.current.defenderKills;

  // --- Revealing animation ---
  useEffect(() => {
    if (phase !== 'revealing') return;
    const s = roundSoldiers[currentRoundRef.current] ?? 1;
    if (revealCount >= s) {
      setPhase('attacker-roll');
      return;
    }
    const t = setTimeout(() => setRevealCount((c) => c + 1), 100);
    return () => clearTimeout(t);
  }, [phase, revealCount]);

  // --- Deaths animation ---
  useEffect(() => {
    if (phase !== 'deaths') return;
    const { attackerKills: aKills, defenderKills: dKills } = roundDataRef.current;
    const totalDeaths = aKills + dKills;

    if (revealCount >= totalDeaths) {
      const { soldiers: s, attackerRoll: aRoll, defenderRoll: dRoll } = roundDataRef.current;
      const result: RoundResult = {
        soldiers: s,
        attackerRoll: aRoll,
        defenderRoll: dRoll,
        attackerKills: aKills,
        defenderKills: dKills,
        winner: aKills > dKills ? 'attacker' : dKills > aKills ? 'defender' : 'tie',
      };
      const newResults = [...roundResultsRef.current, result];
      roundResultsRef.current = newResults;
      setRoundResults(newResults);

      const nextRound = currentRoundRef.current + 1;
      if (nextRound < totalRounds) {
        const t = setTimeout(() => {
          currentRoundRef.current = nextRound;
          setCurrentRound(nextRound);
          setAttackerRoll(null);
          setDefenderRoll(null);
          roundDataRef.current = {
            soldiers: roundSoldiers[nextRound],
            attackerRoll: 0,
            defenderRoll: 0,
            attackerKills: 0,
            defenderKills: 0,
          };
          setRevealCount(0);
          setPhase('revealing');
        }, 600);
        return () => clearTimeout(t);
      } else {
        // Battle over — apply result after 2s
        const t = setTimeout(() => {
          const o = determineBattleOutcome(newResults);
          const totalAttDead = newResults.reduce((s, r) => s + r.defenderKills, 0);

          let msg = '';

          if (isDragon) {
            if (o === 'attacker' || o === 'raze') {
              gameState.gameMessage = `${attacker.name} slays the Dragon! 🐉 VICTORY!`;
              gameState.gameOver = true;
              say(`${attacker.name} slays the Dragon and wins the game! 🎉`, 'success');
              msg = 'The Dragon is slain! 🐉 VICTORY!';
            } else {
              const unitLoss = Math.ceil(attacker.units / 2);
              const goldLoss = attacker.gold;
              attacker.units = Math.max(0, attacker.units - unitLoss);
              attacker.gold = 0;
              gameState.gameMessage = `${attacker.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍`;
              say(
                `${attacker.name} was defeated by the Dragon! Lost ${goldLoss}🟡 and ${unitLoss}🧍.`,
                'error'
              );
              msg = `Lost all gold and ${unitLoss}🧍`;
            }
            setOutcome(o === 'attacker' || o === 'raze' ? 'attacker' : 'defender');
          } else if (isCaravan) {
            if (o === 'attacker') {
              attacker.gold += caravanPrize!;
              gameState.gameMessage = `${attacker.name} raided the caravan and received ${caravanPrize}🟡!`;
              say(`${attacker.name} raided the caravan and received ${caravanPrize}🟡!`, 'success');
              msg = `Received ${caravanPrize}🟡`;
            } else if (o === 'raze') {
              const halfPrize = Math.floor(caravanPrize! / 2);
              attacker.units = Math.max(0, attacker.units - totalAttDead);
              attacker.gold += halfPrize;
              gameState.gameMessage = `${attacker.name} tied with the caravan guards, losing ${totalAttDead}🧍 but receiving ${halfPrize}🟡`;
              say(`${attacker.name} tied with caravan guards, losing ${totalAttDead}🧍 but receiving ${halfPrize}🟡`, 'info');
              msg = `Lost ${totalAttDead}🧍, received ${halfPrize}🟡`;
            } else {
              attacker.units = Math.max(0, attacker.units - totalAttDead);
              gameState.gameMessage = `${attacker.name} failed to raid the caravan, losing ${totalAttDead}🧍`;
              say(`${attacker.name} failed to raid the caravan, losing ${totalAttDead}🧍`, 'error');
              msg = `Lost ${totalAttDead}🧍`;
            }
            setOutcome(o === 'attacker' ? 'attacker' : o === 'raze' ? 'raze' : 'defender');
          } else {
            attacker.units = Math.max(0, attacker.units - totalAttDead);

            if (o === 'attacker') {
              const prevOwner = gameState.players.find((p) => p.name === tile!.owner);
              if (prevOwner) prevOwner.fame = Math.max(1, prevOwner.fame - 1);
              gameState.players.forEach((p) => {
                p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
              });
              tile!.owner = attacker.name;
              tile!._level = 1;
              attacker.ownedTiles.push(attacker.position);
              attacker.fame++;
              gameState.gameMessage = `${attacker.name} won ${tile!.name} sacrificing ${totalAttDead}🧍`;
              say(`${attacker.name} won ${tile!.name} sacrificing ${totalAttDead}🧍`, 'success');
              msg = `${attacker.name} wins ${tile!.name} sacrificing ${totalAttDead}🧍`;
            } else if (o === 'defender') {
              attacker.fame = Math.max(1, attacker.fame - 1);
              gameState.gameMessage = `${attacker.name} lost ${totalAttDead}🧍 in the battle for ${tile!.name}`;
              say(`${attacker.name} lost ${totalAttDead}🧍 in the battle for ${tile!.name}`, 'error');
              msg = `${attacker.name} loses ${totalAttDead}🧍 in the battle for ${tile!.name}`;
            } else {
              const prevOwner = gameState.players.find((p) => p.name === tile!.owner);
              if (prevOwner) prevOwner.fame = Math.max(1, prevOwner.fame - 1);
              attacker.fame = Math.max(1, attacker.fame - 1);
              gameState.players.forEach((p) => {
                p.ownedTiles = p.ownedTiles.filter((idx) => idx !== attacker.position);
              });
              tile!.owner = null;
              tile!._level = 1;
              gameState.gameMessage = `${tile!.name} was razed! ${attacker.name} lost ${totalAttDead}🧍`;
              say(`${tile!.name} was razed! ${attacker.name} loses ${totalAttDead}🧍`, 'info');
              msg = `${tile!.name} was razed! ${attacker.name} loses ${totalAttDead}🧍`;
            }
            setOutcome(o);
          }

          updateGameState(gameState);
          setResultMsg(msg);
          setPhase('result');
        }, 2000);
        return () => clearTimeout(t);
      }
    }

    const t = setTimeout(() => setRevealCount((c) => c + 1), 100);
    return () => clearTimeout(t);
  }, [phase, revealCount]);

  // In caravan/dragon mode the defender auto-rolls — no button shown
  useEffect(() => {
    if (phase !== 'defender-roll' || (!isCaravan && !isDragon)) return;
    const t = setTimeout(() => handleDefenderRoll(), 800);
    return () => clearTimeout(t);
  }, [phase, isCaravan, isDragon]);

  const handleAttackerRoll = () => {
    const roll = rollDice();
    const aKills = Math.min(roll, soldiers);
    roundDataRef.current = { ...roundDataRef.current, attackerRoll: roll, attackerKills: aKills };
    setAttackerRoll(roll);
    setPhase('defender-roll');
  };

  const handleDefenderRoll = () => {
    const roll = rollDice();
    const dKills = Math.min(roll, soldiers);
    roundDataRef.current = {
      soldiers,
      attackerRoll: roundDataRef.current.attackerRoll,
      attackerKills: roundDataRef.current.attackerKills,
      defenderRoll: roll,
      defenderKills: dKills,
    };
    setDefenderRoll(roll);
    setRevealCount(0);
    setPhase('deaths');
  };

  const handleClose = () => {
    clearScreen();
    if (isCaravan) {
      (props as { onClose: () => void }).onClose();
    } else if (isDragon) {
      // Win: gameOver already set — nothing else needed
      // Loss: next turn
      if (outcome !== 'attacker') showDice();
    } else {
      setEndTurn();
    }
  };

  // How many units are visible in current phase
  const unitsShown = phase === 'revealing' ? revealCount : soldiers;

  // Deaths revealed in each row (attacker kills defender first, then defender kills attacker)
  const defenderDeadShown =
    phase === 'deaths' ? Math.min(revealCount, attackerKills) : attackerKills;
  const attackerDeadShown =
    phase === 'deaths' ? Math.max(0, revealCount - attackerKills) : defenderKills;

  const attackerImg = playerImageAssets[attacker.image];
  const defenderImg = defender ? playerImageAssets[defender.image] : null;

  const UnitRow = ({
    total,
    kills,
    deathsShown,
  }: {
    total: number;
    kills: number;
    deathsShown: number;
  }) => {
    const deadStart = total - kills;
    return (
      <div className="battle-unit-row">
        {Array.from({ length: total }, (_, i) => {
          if (i >= unitsShown) return <span key={i} className="battle-unit empty" />;
          const isDead = i >= deadStart;
          const deathIdx = i - deadStart;
          if (isDead && deathIdx < deathsShown) {
            return (
              <span key={i} className="battle-unit dead">
                💥
              </span>
            );
          }
          return (
            <span key={i} className="battle-unit">
              🧍🏻
            </span>
          );
        })}
      </div>
    );
  };

  const rollsKnown = attackerRoll !== null && defenderRoll !== null;
  const roundSequenceEmoji = roundResults
    .map((r) => (r.winner === 'attacker' ? '⚔️' : r.winner === 'defender' ? '☠️' : '🏴'))
    .join('');

  return (
    <ScreenBackground image="assets/screens/battle.jpg">
      <div className="battle-screen">
        <div className="battle-header">
          {isCaravan ? (
            '🐪 Caravan raid!'
          ) : isDragon ? (
            '🐉 Dragon Battle!'
          ) : (
            <>
              ⚔️ Battle for <strong>{tile!.name}</strong>
            </>
          )}
        </div>
        <div className="battle-round-label">
          Round {currentRound + 1} / {totalRounds}
        </div>

        {/* Attacker roll prompt */}
        {phase === 'attacker-roll' && (
          <div className="battle-roll-prompt attacker-prompt">
            <span className="battle-player-name" style={{ color: attacker.color }}>
              {attacker.name}
            </span>
            <button className="game-menu-button battle-roll-btn" onClick={handleAttackerRoll}>
              ⚔️ Attack!
            </button>
          </div>
        )}

        {/* Attacker row */}
        <div className="battle-side attacker-side">
          <div className="battle-player-info">
            <img src={attackerImg} alt={attacker.name} className="battle-player-icon" />
          </div>
          <UnitRow total={soldiers} kills={defenderKills} deathsShown={attackerDeadShown} />
        </div>

        <div className={`battle-divider${rollsKnown ? ' battle-divider--rolls' : ''}`}>
          {rollsKnown ? `🎲${attackerRoll} vs 🎲${defenderRoll}` : '───────────────────'}
        </div>

        {/* Defender row */}
        <div className="battle-side defender-side">
          <UnitRow total={soldiers} kills={attackerKills} deathsShown={defenderDeadShown} />
          <div className="battle-player-info defender-info">
            {defenderImg ? (
              <img src={defenderImg} alt={defender!.name} className="battle-player-icon" />
            ) : (
              <span className="battle-player-icon" style={{ fontSize: '2rem', lineHeight: 1 }}>
                {isDragon ? '🐉' : '🐪'}
              </span>
            )}
          </div>
        </div>

        {/* Defender roll prompt — hidden in caravan/dragon mode (auto-rolls) */}
        {phase === 'defender-roll' && !isCaravan && !isDragon && (
          <div className="battle-roll-prompt defender-prompt">
            <span className="battle-player-name" style={{ color: defender!.color }}>
              {defender!.name}
            </span>
            <button className="game-menu-button battle-roll-btn" onClick={handleDefenderRoll}>
              🛡️ Defend!
            </button>
          </div>
        )}

        {/* Round history */}
        {roundResults.length > 0 && (
          <div className="battle-history">
            {roundResults.map((r, i) => (
              <span key={i} className="battle-history-round">
                R{i + 1}: {r.winner === 'attacker' ? '⚔️' : r.winner === 'defender' ? '☠️' : '🏴'}{' '}
                {r.attackerKills}vs{r.defenderKills}
              </span>
            ))}
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
      <Fade></Fade>
    </ScreenBackground>
  );
};
