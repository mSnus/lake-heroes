import React from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { PlayerLabel } from './PlayerLabel';
import { DecoratedButton } from './DecoratedButton';
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

  return (
    <ScreenBackground image="assets/screens/victory.jpg">
      <Fade />
      <div className="text-title">{tile.name}</div>
      {tile.spriteImage && <SpriteCircleIcon src={tile.spriteImage} />}

      <div className="text-message">
        is now owned by <PlayerLabel player={player} bold />, who now has a fame of 🏆{player.fame}
      </div>

      <div className="text-message tile-card-table-wrap" style={{ marginTop: '24px' }}>
        <table className="tile-card-table">
          <tbody>
            {levels.map((level) => (
              <tr key={level} className={tile.level === level ? 'level-highlighted' : undefined}>
                <td className="tc-td">
                  {tile.prices[level]?.gold ?? 0}🟡 {tile.prices[level]?.units ?? 0}🧍
                </td>
                <td className="tc-td">→</td>
                <td className="tc-td">
                  +{tile.bonuses[level] ?? 0} {bonusTypeIcon}
                </td>
                <td className="tc-td">{tile.getDefence(level)}🛡️</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-message" style={{ marginTop: '24px' }}>
        Upgrade the tile to improve its income and defence.
      </div>

      <div className="game-menu" style={{ top: '40px' }}>
        <div>
          <DecoratedButton onClick={() => clearScreen()}>I am the greatest</DecoratedButton>
        </div>
      </div>
    </ScreenBackground>
  );
};

export default TileClaimScreen;
