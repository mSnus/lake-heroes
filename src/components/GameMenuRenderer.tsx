import React from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { GameMenu, MenuAction, MenuItem } from './GameMenu';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { rollAndMove } from '../actions/rollAndMove';
import { endTurn } from '../actions/endTurn';
import { FEE_MULTIPLIER } from './board/common';
import { sellTile } from '../actions/sellTile';
import { afterMoveLogic } from '../actions/afterMoveLogic';
import { say } from '../utils/say';
import { gameEvent } from '../utils/events';

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

  const handleEndTurn = () => endTurn(board, updateGameState, setMenu);

  if (menu.type === 'main') {
    gameEvent('needDiceRoll', true);

    let items = [
      {
        label: 'Roll Dice 🎲',
        onClick: () => rollAndMove(board, updateGameState, setMenu),
      } as MenuItem,
    ];

    return <GameMenu items={items} top={top}></GameMenu>;
  }

  if (menu.type === 'move-result') {
    // Only used for Prison - show message and end turn
    return (
      <GameMenu
        items={[{ action: 'end-turn', label: 'Continue', onClick: handleEndTurn }]}
        top={top}
      ></GameMenu>
    );
  }

  if (menu.type === 'buy') {
    const items = [] as MenuItem[];

    items.push({
      action: 'end-turn',
      label: 'End turn ⏳',
      onClick: handleEndTurn,
    });

    return <GameMenu items={items} top={top}></GameMenu>;
  }

  if (menu.type === 'end-turn') {
    return (
      <GameMenu
        items={[{ action: 'end-turn', label: 'End turn ⏳', onClick: handleEndTurn }]}
        top={top}
      ></GameMenu>
    );
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
    return <GameMenu items={items} top={top}></GameMenu>;
  }

  if (menu.type === 'sell-to-pay') {
    if (menu.tileIdx === undefined) {
      say(`Tile to sell (menu.tileIdx) is not set`);
      return;
    }

    const tile = board.tiles[activePlayer.ownedTiles[menu.tileIdx]];

    const items = [
      {
        label: `Sell ${tile.name} to pay fee`,
        onClick: () => {
          sellTile(board, activePlayer, tile);
          updateGameState(board);
          // Re-evaluate logic
          afterMoveLogic(board, updateGameState, setMenu);
        },
      } as MenuItem,
    ];

    return <GameMenu items={items} top={top}></GameMenu>;
  }

  return null;
};
