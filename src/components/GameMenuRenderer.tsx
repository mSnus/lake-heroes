import React from 'react';
import { GameState } from '../game/GameState';
import { MenuState } from '../types/menuState';
import { GameMenu, MenuAction } from './GameMenu';
import { buyTile } from '../actions/buyTile';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { rollAndMove } from '../actions/rollAndMove';
import { endTurn } from '../actions/endTurn';

interface GameMenuRendererProps {
  board: GameState;
  menu: MenuState;
  setMenu: (menu: MenuState) => void;
  updateGameState: (board: GameState) => void;
}

export const GameMenuRenderer: React.FC<GameMenuRendererProps> = ({
  board,
  menu,
  setMenu,
  updateGameState,
}) => {
  const activePlayer = board.activePlayer;
  const currentTile = board.tiles[activePlayer.position];

  const handleEndTurn = () => endTurn(board, updateGameState, setMenu);

  if (menu.type === 'main') {
    let items = [
      {
        label: 'Roll Dice 🎲',
        onClick: () => rollAndMove(board, updateGameState, setMenu),
        action: 'roll-dice',
      },
    ];

    // If on ownable tile, show option to sell it
    if (
      (currentTile.isOwnable &&
        !currentTile.isOwned() &&
        activePlayer.gold >= currentTile.prices['1']?.gold) ??
      (0 && activePlayer.units >= currentTile.prices['1']?.units) ??
      0
    ) {
      items.push({
        action: 'buy-tile' as MenuAction,
        label: `Buy for ${currentTile.prices['1']?.gold ?? 0} 🟡 ${currentTile.prices['1']?.units ?? 0} 🧍`,
        onClick: () => {
          buyTile(board, updateGameState);
        },
      });
    }

    return <GameMenu items={items}></GameMenu>;
  }

  if (menu.type === 'move-result') {
    // Only used for Prison - show message and end turn
    return (
      <GameMenu
        title="Prison"
        items={[{ action: 'end-turn', label: 'Continue', onClick: handleEndTurn }]}
      ></GameMenu>
    );
  }

  if (menu.type === 'buy') {
    const tile = currentTile;
    return (
      <GameMenu
        items={[
          {
            action: 'buy-tile',
            label: `Buy for ${tile.prices['1']?.gold ?? 0}🟡 ${tile.prices['1']?.units ?? 0}🧍`,
            onClick: () => {
              buyTile(board, updateGameState);
              setMenu({ type: 'end-turn' });
            },
          },
          { action: 'end-turn', label: 'End turn ⏳', onClick: handleEndTurn },
        ]}
      ></GameMenu>
    );
  }

  if (menu.type === 'end-turn') {
    return (
      <GameMenu
        items={[{ action: 'end-turn', label: 'End turn ⏳', onClick: handleEndTurn }]}
      ></GameMenu>
    );
  }

  if (menu.type === 'fee-or-fight') {
    const tileLevel = currentTile.level;
    const fee = currentTile.defences[tileLevel ?? 1] * 10 || 0;
    const defence = currentTile.defences[tileLevel ?? 1] || 0;
    const items = [
      {
        label: `Pay fee ${fee} 🟡`,
        action: 'pay-fee' as MenuAction,
        onClick: () => payFee(menu, board, updateGameState, handleEndTurn),
        disabled: activePlayer.gold < fee,
      },
      {
        label: `Send ${defence}🧍 to raze`,
        action: 'fight' as MenuAction,
        onClick: () => fightTile(board, updateGameState, setMenu),
        disabled: activePlayer.units < defence,
      },
    ];
    return <GameMenu items={items}></GameMenu>;
  }

  return null;
};
