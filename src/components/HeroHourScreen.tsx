import React, { useEffect } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { showScreen } from '../utils/screenStore';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { BattleScreen } from './BattleScreen';
import { PlayerLabel } from './PlayerLabel';
import { pickHeroHourTarget } from '../ai/decisions';
import { say } from '../utils/say';
import '../styles/BattleScreen.css';

interface HeroHourScreenProps {
  activePlayer: Player;
  opponents: Player[];
  tile: Tile;
  tileOwner: Player | null;
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
  onFightDone: () => void;
  onGreetDone: () => void;
}

export const HeroHourScreen: React.FC<HeroHourScreenProps> = ({
  activePlayer,
  opponents,
  tile,
  tileOwner,
  gameState,
  updateGameState,
  onFightDone,
  onGreetDone,
}) => {
  const handleFight = (opponent: Player) => {
    const battlefieldUnits = Math.min(activePlayer.units, opponent.units);
    showScreen({
      content: React.createElement(BattleScreen, {
        mode: 'player' as const,
        attacker: activePlayer,
        defender: opponent,
        battlefieldUnits,
        gameState,
        updateGameState,
        onClose: onFightDone,
      }),
    });
  };

  const handleGreet = () => {
    onGreetDone();
  };

  useEffect(() => {
    if (!activePlayer.isComputer) return;
    const t = setTimeout(() => {
      const target = pickHeroHourTarget(activePlayer, opponents);
      if (target) {
        say(`${activePlayer.name} decided to attack ${target.name}`, 'info');
        handleFight(target);
      } else {
        handleGreet();
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greetLabel = tileOwner ? `Go to ${tile.name}'s guards` : '✖ Greet and pass';

  return (
    <ScreenBackground image="assets/screens/battle.jpg">
      <Fade />
      <div className="battle-screen">
        <div className="battle-header">Hero's Hour</div>
        <p className="hero-hour-message">
          <PlayerLabel player={activePlayer} /> surprisingly encounters{' '}
          {opponents.map((opponent, i) => (
            <React.Fragment key={opponent.id}>
              {i > 0 && ', '}
              <PlayerLabel player={opponent} />
            </React.Fragment>
          ))}
          .
          <br />
          <br />
          {opponents.length === 1
            ? 'Wouldst thou challenge for a fight?'
            : 'Challenge one of them to fight?'}
        </p>
        <div className="hero-hour-buttons">
          {opponents.map((opponent) => (
            <button
              key={opponent.id}
              className="game-menu-button"
              onClick={() => handleFight(opponent)}
            >
              Fight {opponent.name} ⚔️
            </button>
          ))}
          <button className="game-menu-button" onClick={handleGreet}>
            {greetLabel}
          </button>
        </div>
      </div>
    </ScreenBackground>
  );
};
