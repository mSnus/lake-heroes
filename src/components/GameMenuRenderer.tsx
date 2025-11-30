import React from 'react';
import { Board } from '../game/Board';
import { MenuState } from '../types/menuState';
import { GameMenu } from './GameMenu';
import { TileCard } from './TileCard';
import { buyTile } from '../actions/buyTile';
import { payFee } from '../actions/payFee';
import { fightTile } from '../actions/fightTile';
import { upgradeTile } from '../actions/upgradeTile';
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
    // Determine if the player has at least one upgradeable tile and enough resources
    const hasUpgradeable = activePlayer.ownedTiles.some((idx) => {
      const tile = board.tiles[idx];
      if (!tile || tile.owner !== activePlayer.name) return false;
      if (tile.level >= 3) return false;
      const nextLvl = (tile.level + 1) as 2 | 3;
      const price = tile.upgradePrices[String(nextLvl)];
      return !!price && activePlayer.gold >= price.gold && activePlayer.units >= price.units;
    });

    return (
      <GameMenu
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              aria-label={`Player color`}
              title={`Player color`}
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: activePlayer.color,
                border: '2px solid #000',
                boxSizing: 'border-box',
              }}
            />
            <span>{activePlayer.name}</span>
          </div>
        }
        items={[
          {
            label: 'Roll Dice',
            onClick: () => rollAndMove(board, setBoard, setMenu, handleEndTurn),
            action: 'roll-dice',
          },
        ]}
      >
        {currentTile.isOwnable && !currentTile.owner && <TileCard tile={currentTile} />}
        {currentTile.isOwnable &&
          currentTile.owner === activePlayer.name &&
          activePlayer.name + ' owns ' + currentTile.name}
      </GameMenu>
    );
  }

  if (menu.type === 'move-result') {
    // Only used for Prison - show message and end turn
    return (
      <GameMenu
        title="Prison"
        items={[{ action: 'end-turn', label: 'Continue', onClick: handleEndTurn }]}
      >
        <>
          <div>
            {activePlayer.name} landed on Prison!
            <br />
            Next turn will be skipped.
          </div>
          <TileCard tile={currentTile} />
        </>
      </GameMenu>
    );
  }

  if (menu.type === 'buy') {
    const tile = board.tiles[menu.tileIdx!];
    return (
      <GameMenu
        title="Buy Tile"
        items={[
          {
            action: 'buy-tile',
            label: `Buy ${tile.name} (${tile.priceGold} GP, ${tile.priceUnits} U)`,
            onClick: () => buyTile(menu, board, setBoard, handleEndTurn),
          },
          { action: 'end-turn', label: 'Pass', onClick: handleEndTurn },
        ]}
      >
        <TileCard tile={tile} />
      </GameMenu>
    );
  }

  if (menu.type === 'fee-or-fight') {
    const tile = board.tiles[menu.tileIdx!];
    const tileLevel = tile.level;
    const fee = tile.bonuses[String(tileLevel)] || 0;
    const defence = tile.defences[String(tileLevel)] || 0;
    const items = [
      {
        label: `Pay Fee (${fee} GP)`,
        onClick: () => payFee(menu, board, setBoard, handleEndTurn),
        action: 'pay-fee',
        disabled: activePlayer.gold < fee,
      },
      {
        label: `Fight (cost: ${defence} U)`,
        onClick: () => fightTile(menu, board, setBoard, setMenu, handleEndTurn),
        disabled: activePlayer.units < defence,
        action: 'fight',
      },
    ];
    return (
      <GameMenu title="Pay or Fight" items={items}>
        <>
          <div>
            This tile is owned by {tile.owner}.<br />
            Fee: {fee} GP
            <br />
            Defence: {defence} U
          </div>
          <TileCard tile={tile} />
        </>
      </GameMenu>
    );
  }

  return null;
};
