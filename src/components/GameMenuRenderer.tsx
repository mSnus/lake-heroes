import React, { useEffect } from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { GameMenu, MenuAction, MenuItem } from './GameMenu';
import { buyTile } from '../actions/buyTile';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { rollAndMove } from '../actions/rollAndMove';
import { endTurn } from '../actions/endTurn';
import { FEE_MULTIPLIER } from './board/common';

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
  top
}) => {
  const activePlayer = board.activePlayer;
  const currentTile = board.activeTile;

  const handleEndTurn = () => endTurn(board, updateGameState, setMenu);

  if (menu.type === 'main') {
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
    const tile = currentTile;
    const items = [] as MenuItem[];

    if (tile.isAffordable(activePlayer.gold, activePlayer.units)) {
      items.push({
        action: 'buy-tile',
        label: `Buy for ${tile.prices['1']?.gold ?? 0}🟡 ${tile.prices['1']?.units ?? 0}🧍`,
        onClick: () => {
          buyTile(board, updateGameState);
          setMenu({ type: 'end-turn' });
        },
      });
    }

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
    const fee = currentTile.defences[currentTile.level] * FEE_MULTIPLIER || 0;
    const defence = currentTile.defences[currentTile.level] || 0;
    const items = [
      {
        label: `Pay fee ${fee} 🟡`,
        action: 'pay-fee' as MenuAction,
        onClick: () => payFee(board, updateGameState, setMenu),
        disabled: activePlayer.gold < fee,
      },
      {
        label: `Send ${defence}🧍 to raze 🔥`,
        action: 'fight' as MenuAction,
        onClick: () => fightTile(board, updateGameState, setMenu),
        disabled: activePlayer.units < defence,
      },
    ];
    return <GameMenu items={items} top={top}></GameMenu>;
  }

  return null;
};
