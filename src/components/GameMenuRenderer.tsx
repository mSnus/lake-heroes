import React from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { GameMenu, MenuAction, MenuItem } from './GameMenu';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { fightDragon } from '../actions/fightDragon';
import { rollAndMove } from '../actions/rollAndMove';
import { afterMoveLogic } from '../actions/afterMoveLogic';
import { becomeBeggar } from '../actions/becomeBeggar';
import { OwnedTiles } from './OwnedTiles';
import { gameEvent } from '../utils/events';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { startDiceRoll } from '../utils/modalStore';

interface GameMenuRendererProps {
  gameState: GameState;
  menu: MenuState;
  setMenu: (menu: MenuState) => void;
  updateGameState: (gameState: GameState) => void;
  top: string;
}

export const GameMenuRenderer: React.FC<GameMenuRendererProps> = ({
  gameState,
  menu,
  setMenu,
  updateGameState,
  top,
}) => {
  const activePlayer = gameState.activePlayer;
  const currentTile = gameState.activeTile;

  if (menu.type === 'main') {
    const items = [
      {
        label: 'Roll Dice 🎲',
        onClick: () => rollAndMove(gameState, updateGameState, setMenu),
      } as MenuItem,
    ];
    return <GameMenu items={items} top={top} />;
  }

  if (menu.type === 'fee-or-fight') {
    const fee = currentTile.fee;
    const defence = currentTile.defence;
    const ownerColor = currentTile?.owner
      ? gameState.players.find((p) => p.name === currentTile.owner)?.color
      : undefined;

    const items = [
      {
        label: `Pay fee ${fee} 🟡`,
        action: 'pay-fee' as MenuAction,
        onClick: () => payFee(gameState, updateGameState, setMenu),
        disabled: activePlayer.gold < fee,
      },
      {
        label: `Risk ${defence}🧍 to raze ⚔️🔥`,
        action: 'fight' as MenuAction,
        onClick: () => fightTile(gameState, updateGameState, setMenu),
        disabled: activePlayer.units < defence,
      },
      {
        label: `Accept loss 😢`,
        action: 'fight' as MenuAction,
        onClick: () => {
          becomeBeggar(gameState, updateGameState);
          setMenu({ type: 'prison-beggar' });
        },
      },
    ];
    return (
      <>
        <ScreenBackground image="assets/screens/guards.jpg">
          <Fade></Fade>

          {currentTile.sprite && (
            <div
              style={{
                width: '30vw',
                height: '30vw',
                borderRadius: '50%',
                backgroundImage: `url(assets/sprites2.png)`,
                backgroundSize: '150vw',
                backgroundPositionX: `calc(${currentTile.sprite.x} * -30vw)`,
                backgroundPositionY: `calc(${currentTile.sprite.y} * -30vw)`,
                marginBottom: '16px',
                flexShrink: 0,
                zIndex: 6000,
              }}
            />
          )}
          <div className="text-message">
            <strong style={{ color: activePlayer.color }}>{activePlayer.name}</strong>
            <br/>
            encounters{' '}<strong>{currentTile.name}</strong>
            <br/> that belongs to{' '}
            <strong style={{ color: ownerColor }}>{currentTile.owner}</strong>.
            {activePlayer.units >= defence && (
              <>
                <br /><br />
                <span style={{ fontSize: '1rem', opacity: 0.85 }}>
                  ⚔️ <b>Win</b>: {currentTile.name} is razed, costs you {defence}🧍<br />
                  💀 <b>Lose</b>: costs {defence}🧍 + {fee}🟡 penalty to <span style={{ color: ownerColor }}>{currentTile.owner}</span>
                </span>
              </>
            )}
          </div>
        </ScreenBackground>
        <GameMenu items={items} top={'80vh'} />
      </>
    );
  }

  if (menu.type === 'treasure-waiting') {
    return (
      <>
        <ScreenBackground image="assets/screens/treasure.jpg">
          {currentTile.description && (
            <div
              style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px' }}
              dangerouslySetInnerHTML={{ __html: currentTile.description }}
            />
          )}
        </ScreenBackground>
        <GameMenu items={[{ label: 'Roll Dice 🎲', action: 'roll-dice' as MenuAction, onClick: startDiceRoll }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'treasure-result') {
    return (
      <>
        <ScreenBackground image="assets/screens/treasure.jpg">
          <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
            {gameState.gameMessage}
          </div>
        </ScreenBackground>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'sphynx-waiting') {
    return (
      <>
        <ScreenBackground image="assets/screens/sphynx.jpg">
          {currentTile.description && (
            <div
              style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px' }}
              dangerouslySetInnerHTML={{ __html: currentTile.description }}
            />
          )}
        </ScreenBackground>
        <GameMenu items={[{ label: 'Roll Dice 🎲', action: 'roll-dice' as MenuAction, onClick: startDiceRoll }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'tavern-waiting') {
    return (
      <>
        <ScreenBackground image="assets/screens/tavern.jpg">
          {currentTile.description && (
            <div
              style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px' }}
              dangerouslySetInnerHTML={{ __html: currentTile.description }}
            />
          )}
        </ScreenBackground>
        <GameMenu items={[{ label: 'Roll Dice 🎲', action: 'roll-dice' as MenuAction, onClick: startDiceRoll }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'sphynx-result') {
    return (
      <>
        <ScreenBackground image="assets/screens/sphynx.jpg">
          <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
            {gameState.gameMessage}
          </div>
        </ScreenBackground>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'tavern-result') {
    return (
      <>
        <ScreenBackground image="assets/screens/tavern.jpg">
          <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
            {gameState.gameMessage}
          </div>
        </ScreenBackground>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'fight-win') {
    return (
      <>
        <ScreenBackground image="assets/screens/victory.jpg">
          {gameState.gameMessage && (
            <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
              {gameState.gameMessage}
            </div>
          )}
        </ScreenBackground>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'fight-lose') {
    return (
      <>
        <ScreenBackground image="assets/screens/lost.jpg">
          {gameState.gameMessage && (
            <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
              {gameState.gameMessage}
            </div>
          )}
        </ScreenBackground>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'sell-to-pay') {
    const fee = currentTile.fee;
    const defence = currentTile.defence;
    const ownerColor = currentTile?.owner
      ? gameState.players.find((p) => p.name === currentTile.owner)?.color
      : undefined;

    const sellAndRecheck = (gs: GameState) => {
      updateGameState(gs);
      afterMoveLogic(gs, updateGameState, setMenu);
    };

    return (
      <>
        <ScreenBackground image="assets/screens/guards.jpg">
          <Fade />
          {currentTile.sprite && (
            <div
              style={{
                width: '30vw',
                height: '30vw',
                borderRadius: '50%',
                backgroundImage: `url(assets/sprites2.png)`,
                backgroundSize: '150vw',
                backgroundPositionX: `calc(${currentTile.sprite.x} * -30vw)`,
                backgroundPositionY: `calc(${currentTile.sprite.y} * -30vw)`,
                marginBottom: '16px',
                flexShrink: 0,
                zIndex: 6000,
              }}
            />
          )}
          <div
            style={{
              color: 'white',
              fontSize: '1.4rem',
              textAlign: 'center',
              textShadow: '1px 1px 6px black',
              padding: '0 24px',
              zIndex: 6001,
            }}
          >
            <strong style={{ color: activePlayer.color }}>{activePlayer.name}</strong>
            <br />
            encounters <strong>{currentTile.name}</strong>
            <br /> that belongs to <strong style={{ color: ownerColor }}>{currentTile.owner}</strong>.
            <br /><br />
            <span style={{ fontSize: '1rem', opacity: 0.9 }}>{gameState.gameMessage}</span>
          </div>
        </ScreenBackground>
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 6000, background: 'rgba(0,0,0,0.75)', padding: '8px' }}>
          <div style={{ color: 'white', fontSize: '1rem', textAlign: 'center', padding: '6px 12px 8px', textShadow: '1px 1px 4px black', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>Sell your tiles to pay fee or yield to <strong style={{ color: ownerColor }}>{currentTile.owner}</strong>!</span>
            <button
              className="game-menu-button"
              disabled={activePlayer.gold < fee}
              onClick={() => payFee(gameState, updateGameState, setMenu)}
            >
              Pay fee {fee}🟡
            </button>
            <button
              className="game-menu-button"
              disabled={activePlayer.units < defence}
              onClick={() => fightTile(gameState, updateGameState, setMenu)}
            >
              Raze ⚔️🔥
            </button>
            <button
              className="game-menu-button"
              onClick={() => { becomeBeggar(gameState, updateGameState); setMenu({ type: 'prison-beggar' }); }}
            >
              Accept loss 😢
            </button>
          </div>
          <OwnedTiles gameState={gameState} updateGameState={sellAndRecheck} />
        </div>
      </>
    );
  }

  if (menu.type === 'prison-regular' || menu.type === 'prison-beggar') {
    return (
      <>
        <ScreenBackground image="assets/screens/prison.jpg">
          {gameState.gameMessage && (
            <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px' }}>
              {gameState.gameMessage}
            </div>
          )}
        </ScreenBackground>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </>
    );
  }

  if (menu.type === 'dragon-challenge') {
    const items: MenuItem[] = [
      {
        label: 'Challenge the Dragon 🐉',
        action: 'fight' as MenuAction,
        onClick: () => fightDragon(gameState, updateGameState, setMenu),
      },
      {
        label: 'Roll Dice Instead 🎲',
        action: 'roll-dice' as MenuAction,
        onClick: () => {
          setMenu(null as unknown as MenuState);
          gameEvent('showDice', null);
        },
      },
    ];
    return <GameMenu items={items} top={top} />;
  }

  return null;
};
