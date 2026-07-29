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
import { remainingCapacity } from '../game/army';
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

  // Capped by both the tile's slot capacity and whatever Militia the player
  // actually has left (post-battle casualties already applied by the time
  // this screen shows).
  const maxGarrison = Math.min(
    remainingCapacity(tile.garrisonMilitia, tile.garrisonRiders, tile.garrisonSlots, 'militia'),
    player.militia
  );
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
                <div className="tc-td" style={{textAlign:'center', paddingBottom: '0.5rem'}}>
                  income: <span className="value">{tile.bonuses[1] ?? 0}</span>{bonusTypeIcon}
                </div>
                <div className="tc-td" style={{paddingTop: '0.5rem', textAlign: 'center'}}>
                  How many?
                  <div className="units-input-row" style={{ justifyContent: 'center' }}>
                    <input
                      type="number"
                      value={garrisonAmount}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        const clamped = Number.isNaN(parsed)
                          ? 0
                          : Math.min(maxGarrison, Math.max(0, parsed));
                        setGarrisonAmount(clamped);
                      }}
                      min="0"
                      max={maxGarrison}
                      id="garrisonInput"
                      style={{ width: '2rem' }}
                      className="units-input"
                    />
                    ({player.militia - garrisonAmount}🧍 stay in army)
                  </div>
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
                <div className="tc-td" style={{paddingTop: '2rem', fontSize: '1rem'}}>
                    👛 <span className="value">{tile.prices[2]?.gold ?? 0}</span>🟡 →{' '}
                    +<span className="value">{tile.bonuses[2] ?? 0}</span>{bonusTypeIcon} per year and{' '}
                    <span className="value">2</span>🏯
                </div>
                <div className="tc-td" style={{fontSize: '1rem'}}>
                    👛 <span className="value">{tile.prices[3]?.gold ?? 0}</span>🟡 →{' '}
                    +<span className="value">{tile.bonuses[3] ?? 0}</span>{bonusTypeIcon} per year and{' '}
                    <span className="value">3</span>🏯
                </div>
        </div>
      </div>


      <div className="game-menu" style={{ top: '40px' }}>
        <div>
          <DecoratedButton onClick={handleSetGarrison}>
            {garrisonAmount === 0 ? 'Leave unguarded' : `Set ${garrisonAmount} to guard 🛡️`}
          </DecoratedButton>
        </div>
      </div>
    </ScreenBackground>
  );
};

export default TileClaimScreen;
