import React from 'react';
import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { GameMenu } from './GameMenu';
import { buyTile } from '../actions/buyTile';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { rollAndMove } from '../actions/rollAndMove';
import { endTurn } from '../actions/endTurn';

interface GameMenuRendererProps {
  board: Board;
  menu: MenuState;
  setMenu: (menu: MenuState) => void;
  setBoard: (board: Board) => void;
}

export const GameMenuRenderer: React.FC<GameMenuRendererProps> = ({
  board,
  menu,
  setMenu,
  setBoard,
}) => {
  const activePlayer = board.activePlayer;
  const currentTile = board.tiles[activePlayer.position];

  const handleEndTurn = () => endTurn(board, setBoard, setMenu);

  if (menu.type === 'main') {
    return (
      <GameMenu
        items={[
          {
            label: 'Roll Dice',
            onClick: () => rollAndMove(board, setBoard, setMenu, handleEndTurn),
            action: 'roll-dice',
          },
        ]}
      ></GameMenu>
    );
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
    const tile = board.tiles[menu.tileIdx!];
    return (
      <GameMenu
        items={[
          {
            action: 'buy-tile',
            label: `Buy for ${tile.priceGold} 🟡 ${tile.priceUnits} 🧍`,
            onClick: () => {
              buyTile(menu, board, setBoard, handleEndTurn);
              setMenu({ type: 'main' });
            },
          },
          { action: 'end-turn', label: 'Pass', onClick: handleEndTurn },
        ]}
      ></GameMenu>
    );
  }

  if (menu.type === 'fee-or-fight') {
    const tile = board.tiles[menu.tileIdx!];
    const tileLevel = tile.level;
    const fee = tile.bonuses[tileLevel] || 0;
    const defence = tile.defences[tileLevel] || 0;
    const items = [
      {
        label: `Pay Fee ${fee} 🟡`,
        action: 'pay-fee',
        onClick: () => payFee(menu, board, setBoard, handleEndTurn),
        disabled: activePlayer.gold < fee,
      },
      {
        label: `Fight ${defence} 🧍`,
        action: 'fight',
        onClick: () => fightTile(menu, board, setBoard, setMenu, handleEndTurn),
        disabled: activePlayer.units < defence,
      },
    ];
    return (
      <GameMenu items={items}>
        <>
          <div>
            This tile is owned by {tile.owner}.<br />
          </div>
        </>
      </GameMenu>
    );
  }

  return null;
};
