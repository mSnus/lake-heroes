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
import { getCharacterConfig } from '../ai/decisions';
import { useT } from '../i18n';
import { tJsx } from '../i18n/tJsx';
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
  const t = useT();
  const bonusTypeIcon = tile.bonusType === 'units' ? '👬' : '🟡';
  const levels = [1, 2, 3];

  // Capped by both the tile's slot capacity and whatever Militia the player
  // actually has left (post-battle casualties already applied by the time
  // this screen shows).
  const maxGarrison = Math.min(
    remainingCapacity(tile.garrisonMilitia, tile.garrisonRiders, tile.garrisonSlots, 'militia'),
    player.militia
  );
  const [garrisonAmount, setGarrisonAmount] = useState(() =>
    Math.min(maxGarrison, Math.floor(player.militia / 2))
  );

  useEffect(() => {
    if (!player.isComputer) return;
    const fraction = getCharacterConfig(player)?.claimGarrisonFraction ?? 0;
    const amount = Math.min(maxGarrison, Math.floor(fraction * player.militia));
    const timer = setTimeout(() => {
      if (amount > 0) {
        setTileGarrison(gameState, player, tile, amount);
        updateGameState(gameState);
      }
      clearScreen();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <div className="text-message" style={{lineHeight: '1.2', whiteSpace: 'pre-line'}}>
        {tJsx('tileClaimScreen.claimedBy', {
          player: <PlayerLabel player={player} bold />,
          fame: <>🏆{player.fame}</>,
        })}
      </div>



      <div className="text-message tile-card-table-wrap" style={{ marginTop: '3rem' }}>
        <div className="tile-card-table" style={{fontSize: '1.1rem', fontFamily: 'Encode', color: 'wheat'}}>
                <div className="tc-td" style={{textAlign:'center'}}>
                  {tJsx('tileClaimScreen.currentIncome', { value: <span className="value">{tile.bonuses[1] ?? 0}</span>, icon: bonusTypeIcon })}
                </div>
                <div className="tc-td" style={{paddingTop: '0.5rem', fontSize: '1rem'}}>
                    {tJsx('tileClaimScreen.upgradeLine', {
                      gold: <span className="value">{tile.prices[2]?.gold ?? 0}</span>,
                      slots: <span className="value">2</span>,
                      bonus: <span className="value">{tile.bonuses[2] ?? 0}</span>,
                      icon: bonusTypeIcon,
                    })}
                </div>
                <div className="tc-td" style={{fontSize: '1rem'}}>
                    {tJsx('tileClaimScreen.upgradeLine', {
                      gold: <span className="value">{tile.prices[3]?.gold ?? 0}</span>,
                      slots: <span className="value">3</span>,
                      bonus: <span className="value">{tile.bonuses[3] ?? 0}</span>,
                      icon: bonusTypeIcon,
                    })}
                </div>
                {player.militia > 0 && (
                  <div className="tc-td" style={{paddingTop: '1.5rem', textAlign: 'center'}}>
                    {t('tileClaimScreen.howManyToGuard')}
                    <div className="units-input-row" style={{ justifyContent: 'center' }}>
                      🛡️
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
                        style={{ width: '2rem', fontSize: '150%' }}
                        className="units-input"
                      />
                      {t('tileClaimScreen.stayInArmy', { count: player.militia - garrisonAmount })}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'stretch', marginTop: '0.5rem' }}>
                      <button
                        className="game-menu-button silver"
                        onClick={() => setGarrisonAmount((a) => Math.max(0, a - 1))}
                      >
                        −
                      </button>
                      <button
                        className="game-menu-button silver"
                        onClick={() => setGarrisonAmount(Math.min(maxGarrison, Math.floor(player.militia / 2)))}
                      >
                        {Math.min(maxGarrison, Math.floor(player.militia / 2))}🧍
                      </button>
                      <button
                        className="game-menu-button silver"
                        onClick={() => setGarrisonAmount((a) => Math.min(maxGarrison, a + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
        </div>
      </div>


      <div className="game-menu" style={{ top: '40px' }}>
        <div>
          <DecoratedButton onClick={handleSetGarrison}>
            {garrisonAmount === 0 ? t('tileClaimScreen.leaveUnguarded') : t('tileClaimScreen.setToGuard', { amount: garrisonAmount })}
          </DecoratedButton>
        </div>
      </div>
    </ScreenBackground>
  );
};

export default TileClaimScreen;
