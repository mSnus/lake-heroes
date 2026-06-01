import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { clearScreen, markScreenResolved } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { showDice } from '../utils/diceStore';
import { say } from '../utils/say';
import { playerImageAssets } from '../game/PlayerOptions';
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

  const defence = isCaravan
    ? (caravanDefence ?? 1)
    : isDragon
      ? DRAGON_UNITS
      : (tile?.defence ?? 1);
  const totalRounds = roundCount(defence);

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

  // Log battle start
  useEffect(() => {
    say(
      `⚔️ Battle: ${attacker.name} vs ${defenderLabel} (${totalRounds} round${totalRounds > 1 ? 's' : ''})`,
      'debug'
    );
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

    const roundWinner =
      result.winner === 'attacker' ? attacker.name
      : result.winner === 'defender' ? defenderLabel
      : 'Tie';
    say(
      `  Round ${roundIdx + 1}: ${attacker.name} 🎲${aRoll} · ${defenderLabel} 🎲${roll} → ${roundWinner}`,
      'debug'
    );

    const nextRound = roundIdx + 1;
    if (nextRound < totalRounds) {
      currentRoundRef.current = nextRound;
      setCurrentRound(nextRound);
      setPhase('attacker-roll');
    } else {
      const o = determineBattleOutcome(newResults);
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
          gameState.gameMessage = `${attacker.name} raided the caravan and pillaged ${caravanPrize}🟡!`;
          say(`${attacker.name} raided the caravan and pillaged ${caravanPrize}🟡!`, 'success');
          msg = `Pillaged ${caravanPrize}🟡`;
          setShowVictoryBg(true);
          setOutcome('attacker');
        } else if (o === 'tie') {
          const halfPrize = Math.floor(caravanPrize! / 2);
          attacker.gold += halfPrize;
          gameState.gameMessage = `${attacker.name} tied with the caravan guards, receiving ${halfPrize}🟡`;
          say(`${attacker.name} tied with caravan guards, receiving ${halfPrize}🟡`, 'info');
          msg = `Received ${halfPrize}🟡`;
          setOutcome('tie');
        } else {
          gameState.gameMessage = `${attacker.name} failed to raid the caravan`;
          say(`${attacker.name} failed to raid the caravan`, 'error');
          msg = `The caravan got away`;
          setOutcome('defender');
        }
      } else {
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
          gameState.gameMessage = `Glorious victory! ${attacker.name} conquered ${tile!.name}!`;
          say(`${attacker.name} conquered ${tile!.name}!`, 'success');
          msg = `Glorious victory! ${attacker.name} wins ${tile!.name}!`;
          setShowVictoryBg(true);
          setOutcome('attacker');
        } else if (o === 'defender') {
          attacker.fame = Math.max(1, attacker.fame - 1);
          gameState.gameMessage = `${attacker.name} lost the battle for ${tile!.name}`;
          say(`${attacker.name} lost the battle for ${tile!.name}`, 'error');
          msg = `${attacker.name} retreats from ${tile!.name}`;
          setOutcome('defender');
        } else {
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

  // Per-round icons: winner keeps 🧍🏻, loser gets 💥, tie gets 🏴
  const attackerRoundIcon = (r: RoundResult) =>
    r.winner === 'attacker' ? '🧍🏻' : r.winner === 'defender' ? '💥' : '🏴';
  const defenderRoundIcon = (r: RoundResult) =>
    r.winner === 'defender' ? '🧍🏻' : r.winner === 'attacker' ? '💥' : '🏴';

  const battleResultEmoji = roundResults
    .map((r) => (r.winner === 'attacker' ? '⚔️' : r.winner === 'defender' ? '☠️' : '🏴'))
    .join('');

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

      {/* Dice overlays — position:fixed, appear in center of screen */}
      {rollingAttacker && (
        <DiceWidget key={`a-${currentRound}`} rolling={true} onRoll={onAttackerRollDone} />
      )}
      {rollingDefender && (
        <DiceWidget key={`d-${currentRound}`} rolling={true} onRoll={onDefenderRollDone} />
      )}

      <div className="battle-screen">
        <div className="battle-header">
          {isCaravan ? 'Caravan raid!' : isDragon ? 'Dragon Attack' : <>⚔️ Battle for <strong>{tile!.name}</strong></>}
        </div>

          
        <div className="battle-names-row">
          <div className="bc-attacker">
            <img src={attackerImg} alt={attacker.name} className="battle-player-icon" />
            <br/>
            <span className="battle-player-name" style={{ color: attacker.color }}>{attacker.name}</span>
          </div>
          <div className="bc-defender">
            {defenderImg
              ? <img src={defenderImg} alt={defender!.name} className="battle-player-icon" />
              : <span className="battle-emoji-icon">{isDragon ? '🐉' : '🐪'}</span>}
              <br/>
            <span className="battle-player-name" style={{ color: defenderColor }}>{defenderLabel}</span>
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
                  {phase === 'defender-roll' && (
                    <span className="battle-round-icon">🧍🏻</span>
                  )}
                </div>
                <div className="bc-roll bc-roll-attacker">
                  {phase === 'defender-roll' && pendingAttackerRoll !== null
                    ? <>🎲 {pendingAttackerRoll}</>
                    : <span className="dim">·</span>}
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
                {outcome === 'attacker' ? ` ${attacker.name} won the battle!`
                  : outcome === 'defender' ? ` ${attacker.name} lost the battle!`
                  : ' A tie!'}
              </span>
            </div>
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
