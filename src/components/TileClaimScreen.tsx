import React, { useEffect } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { PlayerLabel } from './PlayerLabel';
import { DecoratedButton } from './DecoratedButton';
import IncomeDefence from './IncomeDefence';
import { clearScreen } from '../utils/screenStore';
import '../styles/TileCard.css';
import '../styles/GameMenu.css';

interface TileClaimScreenProps {
  tile: Tile;
  player: Player;
}

export const TileClaimScreen: React.FC<TileClaimScreenProps> = ({ tile, player }) => {
  const bonusTypeIcon = tile.bonusType === 'units' ? '👬' : '🟡';
  const levels = [1, 2, 3];

  useEffect(() => {
    if (!player.isComputer) return;
    const t = setTimeout(() => clearScreen(), 800);
    return () => clearTimeout(t);
  }, [player]);

  return (
    <ScreenBackground image="assets/screens/victory.jpg" style={{paddingTop: '8rem'}}>
      <Fade />
      <Fade />
      {tile.spriteImage && <SpriteCircleIcon src={tile.spriteImage} size='5rem'/>}
      <div className="text-title" style={{ marginBottom: '0'}}>{tile.name}</div>

      <div className="text-message" style={{lineHeight: '1.2'}}>
        was claimed by <PlayerLabel player={player} bold /><br />
        who's fame is now 🏆{player.fame}
      </div>
    


      <div className="text-message tile-card-table-wrap" style={{ marginTop: '3rem' }}>
        <div className="tile-card-table" style={{fontSize: '1.1rem', fontFamily: 'Encode', color: 'wheat'}}>
          <IncomeDefence 
          income={tile.bonuses[1] ?? 0}
          defence={tile.getDefence(1)}
          incomeHint="income"
          defenceHint="defence"
          bonusTypeIcon={bonusTypeIcon}
          />

                <div className="tc-td" style={{paddingTop: '2rem'}}>
                    👛 <span className="value">+{tile.prices[2]?.gold ?? 0}</span>🟡{' '}
                    <span className="value">{tile.prices[2]?.units ?? 0}</span>🧍{' '}
                    to upgrade to <span className="value">{tile.bonuses[2] ?? 0}</span>{bonusTypeIcon}
                  
                  {' '}/{' '}<span className="value">{tile.getDefence(2)}</span>🛡️
                </div>
                <div className="tc-td">
                    👛 <span className="value">+{tile.prices[3]?.gold ?? 0}</span>🟡{' '}
                    <span className="value">{tile.prices[3]?.units ?? 0}</span>🧍{' '}
                    to upgrade to <span className="value">{tile.bonuses[3] ?? 0}</span>{bonusTypeIcon}
                  
                  {' '}/{' '}<span className="value">{tile.getDefence(3)}</span>🛡️
                </div>
        </div>
      </div>


      <div className="game-menu" style={{ top: '40px' }}>
        <div>
          <DecoratedButton onClick={() => clearScreen()}>I am the greatest!</DecoratedButton>
        </div>
      </div>
    </ScreenBackground>
  );
};

export default TileClaimScreen;
