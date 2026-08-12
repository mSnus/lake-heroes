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
import { useT } from '../i18n';
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
  const t = useT();
  const handleFight = (opponent: Player) => {
    const battlefieldUnits = Math.min(activePlayer.units, opponent.units);
    showScreen({
      screenType: 'player-battle',
      defenderId: opponent.id,
      battlefieldUnits,
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
    const timer = setTimeout(() => {
      const target = pickHeroHourTarget(activePlayer, opponents);
      if (target) {
        say(t('heroHourScreen.decidedToAttack', { playerName: activePlayer.name, targetName: target.name }), 'info');
        handleFight(target);
      } else {
        handleGreet();
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greetLabel = tileOwner
    ? t('heroHourScreen.goToGuards', { tileName: tile.name })
    : t('heroHourScreen.greetAndPass');

  const armyLabel = (player: Player) => (
    <>
      🧍{player.militia}
      {player.riders > 0 && <> 🐎{player.riders}</>}
    </>
  );

  return (
    <ScreenBackground image="assets/screens/battle.jpg">
      <Fade />
      <div className="battle-screen">
        <div className="battle-header">{t('battleScreen.heroHour')}</div>
        <p className="hero-hour-message">
          <PlayerLabel player={activePlayer} /> {armyLabel(activePlayer)} {t('heroHourScreen.encounters')}{' '}
          {opponents.map((opponent, i) => (
            <React.Fragment key={opponent.id}>
              {i > 0 && ', '}
              <PlayerLabel player={opponent} /> {armyLabel(opponent)}
            </React.Fragment>
          ))}
          .
          <br />
          <br />
          {opponents.length === 1
            ? t('heroHourScreen.challengeSingular')
            : t('heroHourScreen.challengePlural')}
        </p>
        <div className="hero-hour-buttons">
          {opponents.map((opponent) => (
            <button
              key={opponent.id}
              className="game-menu-button"
              onClick={() => handleFight(opponent)}
            >
              {t('heroHourScreen.fightButton', { name: opponent.name })}
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
