import React from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { GameMenu, MenuAction, MenuItem } from './GameMenu';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { fightDragon } from '../actions/fightDragon';
import { rollAndMove } from '../actions/rollAndMove';
import { FEE_MULTIPLIER } from './board/common';
import { sellTile } from '../actions/sellTile';
import { afterMoveLogic } from '../actions/afterMoveLogic';
import { say } from '../utils/say';
import { gameEvent } from '../utils/events';
import { ScreenBackground } from './ScreenBackground';
import { Fade } from './Fade';
import { startDiceRoll } from '../utils/modalStore';

interface GameMenuRendererProps {
  board: GameState;
  menu: MenuState;
  setMenu: (menu: MenuState) => void;
  updateGameState: (board: GameState) => void;
  top: string;
}

export const GameMenuRenderer: React.FC<GameMenuRendererProps> = ({
  board,
  menu,
  setMenu,
  updateGameState,
  top,
}) => {
  const activePlayer = board.activePlayer;
  const currentTile = board.activeTile;

  if (menu.type === 'main') {
    const items = [
      {
        label: 'Roll Dice 🎲',
        onClick: () => rollAndMove(board, updateGameState, setMenu),
      } as MenuItem,
    ];
    return <GameMenu items={items} top={top} />;
  }

  if (menu.type === 'fee-or-fight') {
    const fee = currentTile.fee;
    const defence = currentTile.defence;
    const items = [
      {
        label: `Pay fee ${fee} 🟡`,
        action: 'pay-fee' as MenuAction,
        onClick: () => payFee(board, updateGameState, setMenu),
        disabled: activePlayer.gold < fee,
      },
      {
        label: `Risk ${defence}🧍 to raze ⚔️🔥`,
        action: 'fight' as MenuAction,
        onClick: () => fightTile(board, updateGameState, setMenu),
        disabled: activePlayer.units < defence,
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
            <strong>{activePlayer.name}</strong> encounters <strong>{currentTile.name}</strong> that
            belongs to <strong>{currentTile.owner}</strong>. Pay fee or try to raze it?
          </div>
        </ScreenBackground>
        <GameMenu items={items} top={'80vh'} />
      </>
    );
  }

  if (menu.type === 'sphynx-waiting') {
    return (
      <ScreenBackground image="assets/screens/sphynx.jpg">
        {currentTile.description && (
          <div
            style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px' }}
            dangerouslySetInnerHTML={{ __html: currentTile.description }}
          />
        )}
        <GameMenu items={[{ label: 'Roll Dice 🎲', action: 'roll-dice' as MenuAction, onClick: startDiceRoll }]} top="80vh" />
      </ScreenBackground>
    );
  }

  if (menu.type === 'tavern-waiting') {
    return (
      <ScreenBackground image="assets/screens/tavern.jpg">
        {currentTile.description && (
          <div
            style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px' }}
            dangerouslySetInnerHTML={{ __html: currentTile.description }}
          />
        )}
        <GameMenu items={[{ label: 'Roll Dice 🎲', action: 'roll-dice' as MenuAction, onClick: startDiceRoll }]} top="80vh" />
      </ScreenBackground>
    );
  }

  if (menu.type === 'sphynx-result') {
    return (
      <ScreenBackground image="assets/screens/sphynx.jpg">
        <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
          {board.gameMessage}
        </div>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </ScreenBackground>
    );
  }

  if (menu.type === 'tavern-result') {
    return (
      <ScreenBackground image="assets/screens/tavern.jpg">
        <div style={{ color: 'white', fontSize: '1.4rem', textAlign: 'center', textShadow: '1px 1px 6px black', padding: '0 24px', marginBottom: '16px' }}>
          {board.gameMessage}
        </div>
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </ScreenBackground>
    );
  }

  if (menu.type === 'fight-win') {
    return (
      <ScreenBackground image="assets/screens/victory.jpg">
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </ScreenBackground>
    );
  }

  if (menu.type === 'fight-lose') {
    return (
      <ScreenBackground image="assets/screens/lost.jpg">
        <GameMenu items={[{ label: 'Continue', action: 'end-turn' as MenuAction, onClick: () => setMenu({ type: 'end-turn' }) }]} top="80vh" />
      </ScreenBackground>
    );
  }

  if (menu.type === 'sell-to-pay') {
    if (menu.tileIdx === undefined) {
      say(`Tile to sell (menu.tileIdx) is not set`);
      return null;
    }

    const tile = board.tiles[activePlayer.ownedTiles[menu.tileIdx]];

    const items = [
      {
        label: `Sell ${tile.name} to pay fee`,
        onClick: () => {
          sellTile(board, activePlayer, tile);
          updateGameState(board);
          afterMoveLogic(board, updateGameState, setMenu);
        },
      } as MenuItem,
    ];

    return <GameMenu items={items} top={top} />;
  }

  if (menu.type === 'dragon-challenge') {
    const items: MenuItem[] = [
      {
        label: 'Challenge the Dragon 🐉',
        action: 'fight' as MenuAction,
        onClick: () => fightDragon(board, updateGameState, setMenu),
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
