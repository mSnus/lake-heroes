import React, { useEffect, useState } from 'react';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import { GameState } from '../game/GameState';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { PlayerLabel } from './PlayerLabel';
import { DecoratedButton } from './DecoratedButton';
import { clearScreen } from '../utils/screenStore';
import { setTileGarrison } from '../actions/garrisonTile';
import { ARMY_SLOT_CAPACITY } from '../game/constants';
import '../styles/TileCard.css';
import '../styles/GameMenu.css';

interface TileClaimScreenProps {
  tile: Tile;
  player: Player;
  gameState: GameState;
  updateGameState: (board: GameState) => void;
}

export const TileClaimScreen: React.FC<TileClaimScreenProps> = ({
  tile,
  player,
  gameState,
  updateGameState,
}) => {
  const bonusTypeIcon = tile.bonusType === 'units' ? '👬' : '🟡';
  const levels = [1, 2, 3];

  const maxGarrison = Math.min(tile.garrisonSlots * ARMY_SLOT_CAPACITY, player.militia);
  const [garrisonAmount, setGarrisonAmount] = useState(0);

  useEffect(() => {
    if (!player.isComputer) return;
    const t = setTimeout(() => clearScreen(), 800);
    return () => clearTimeout(t);
  }, [player]);

  const handleSetGarrison = () => {
    setTileGarrison(gameState, player, tile, garrisonAmount);
    updateGameState(gameState);
    clearScreen();
  };

  return (
    <ScreenBackground image="assets/screens/victory.jpg" style={{paddingTop: '1rem'}}>
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
                <div className="tc-td" style={{borderBottom: 'solid 1px #eeeeee50', textAlign:'center', paddingBottom: '2rem'}}>
                  income: <span className="value">{tile.bonuses[1] ?? 0}</span>{bonusTypeIcon}
                </div>
                <div className="tc-td" style={{paddingTop: '2rem', textAlign: 'center'}}>
                  garrison how many? <span className="value">{garrisonAmount}</span>🧍
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <button
                      className="game-menu-button small silver"
                      onClick={() => setGarrisonAmount((a) => Math.max(0, a - 1))}
                    >
                      −
                    </button>
                    <button
                      className="game-menu-button silver"
                      onClick={() => setGarrisonAmount(Math.floor(maxGarrison / 2))}
                    >
                      + 1/2
                    </button>
                    <button
                      className="game-menu-button small silver"
                      onClick={() => setGarrisonAmount((a) => Math.min(maxGarrison, a + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="tc-td" style={{paddingTop: '2rem'}}>
                    👛 <span className="value">+{tile.prices[2]?.gold ?? 0}</span>🟡{' '}
                    <span className="value">{tile.prices[2]?.units ?? 0}</span>🧍{' '}
                    to upgrade to <span className="value">{tile.bonuses[2] ?? 0}</span>{bonusTypeIcon}

                  {' '}and{' '}<span className="value">{tile.getDefence(2)}</span>🛡️
                </div>
                <div className="tc-td">
                    👛 <span className="value">+{tile.prices[3]?.gold ?? 0}</span>🟡{' '}
                    <span className="value">{tile.prices[3]?.units ?? 0}</span>🧍{' '}
                    to upgrade to <span className="value">{tile.bonuses[3] ?? 0}</span>{bonusTypeIcon}

                  {' '}and{' '}<span className="value">{tile.getDefence(3)}</span>🛡️
                </div>
        </div>
      </div>


      <div className="game-menu" style={{ top: '40px' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <DecoratedButton onClick={handleSetGarrison}>
            Set {garrisonAmount} to guard 🛡️
          </DecoratedButton>
          <DecoratedButton onClick={() => clearScreen()}>I am the greatest!</DecoratedButton>
        </div>
      </div>
    </ScreenBackground>
  );
};

export default TileClaimScreen;
