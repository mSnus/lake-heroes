import React, { useEffect } from 'react';
import { GameState } from '../game/GameState';
import groupsData from '../settings/groups.json';

import { TILE_COUNT } from '../game/constants';
import { getTilePosition, isMobileLayout, parseTileName } from './board/common';
import { useMapEditStore, mapEditSelectTile } from '../utils/mapEditStore';
import '../styles/Board.css';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { gameEvent } from '../utils/events';
import { handleKingCastle } from '../actions/king';

interface BoardCanvasProps {
  board: GameState;
  updateGameState: (board: GameState) => void;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board, updateGameState }) => {
  const isMobile = isMobileLayout();
  const mapEdit = useMapEditStore();

  const offsetX = isMobile ? 10 : 0;
  const offsetY = isMobile ? 8 : 0;

  const CANVAS_WIDTH = isMobileLayout() ? '100vw' : '100vw';
  const CANVAS_HEIGHT = isMobileLayout() ? '100vw' : '100vh';
  const WRAPPER_HEIGHT = isMobileLayout() ? '100vw' : '100vh';

  const [mapReady, setMapReady] = React.useState(false);
  const mapUrl = 'assets/map12.jpg';

  // Preload map so tiles render only after background is ready
  useEffect(() => {
    const img = new Image();
    img.src = mapUrl;
    img.onload = () => setMapReady(true);
  }, [isMobile]);

  // groups lookup
  const groupsByName: Record<string, { name: string; icon: string; color: string }> =
    React.useMemo(() => {
      const map: Record<string, { name: string; icon: string; color: string }> = {};
      (groupsData as any[]).forEach((g: any) => {
        if (g && g.name) map[g.name] = { name: g.name, icon: g.icon, color: g.color };
      });
      return map;
    }, []);

  const renderTile = (tile: any, i: number) => {
    const grp = tile?.group ? groupsByName[tile.group] : undefined;

    const pos = getTilePosition(i);
    let tileClass = 'tile';
    if (pos?.textPos === 'left') tileClass += ' tile-left';
    if (pos?.textPos === 'right') tileClass += ' tile-right';
    if (!tile.isOwnable) tileClass += ' tile-sprite-special';

    const handleTileClick = () => {
      if (!tile) return;
      if (mapEdit.active) {
        mapEditSelectTile(i);
        return;
      }
      const isActivePlayerTile = board.activePlayer.position % TILE_COUNT === i;
      if (isActivePlayerTile && tile.name.includes('King')) {
        handleKingCastle(board, updateGameState);
        return;
      }
      gameEvent('displayTile', tile.fogged() ? {} : tile);
    };

    const isMapEditSelected = mapEdit.active && mapEdit.selectedIndex === i;

    const isFogged = tile.fogged();
    const ownedClass = tile.isOwned() ? 'tile-sprite-owned' : 'tile-sprite-unowned';

    const owner = tile.owner ? board.players.find((p) => p.name === tile.owner) : null;
    const ownerColor = owner?.color || '#444';
    const ownerShadow = tile.isOwned() ? ownerColor + ' 0px 0px 0px 4px inset' : 'none';

    return (
      <div
        key={`tile-${i}`}
        className={tileClass}
        style={{
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + '%',
          ...(isMapEditSelected ? { outline: '3px solid yellow', outlineOffset: '2px', zIndex: 999 } : {}),
        }}
        onClick={handleTileClick}
      >
        <div className="tile-content">
          {tile?.name &&
            (() => {
              const { textPart1, textPart2 } = parseTileName(tile.name);
              const isKingTile = textPart1?.substring(0, 4) === 'King';
              const tileSizeClass = isKingTile
                ? 'tile-sprite-container tile-big'
                : 'tile-sprite-container';

              return (
                <>
                  {!isKingTile && !isFogged && tile.isOwnable && (
                    <div
                      className="tile-title"
                      style={{
                        color: grp?.color || '#FFF',
                      }}
                    >
                      {textPart1} {isMobileLayout() ? '' : textPart2}
                    </div>
                  )}
                  {(tile.spriteImage || isFogged) && (
                    <div className={tileSizeClass}>
                      <div
                        className={`tile-sprite ${ownedClass}`}
                        style={
                          isFogged
                            ? {
                                backgroundImage: `url(assets/fog.png)`,
                                backgroundSize: 'cover',
                                borderRadius: '50%',
                                boxShadow: 'none',
                              }
                            : {
                                backgroundImage: `url(${tile.spriteImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                boxShadow: ownerShadow,
                              }
                        }
                      ></div>
                    </div>
                  )}
                </>
              );
            })()}
        </div>
      </div>
    );
  };

  const renderPlayer = (player: any, i: number) => {
    const tileNumber = player.position % TILE_COUNT;
    const pos = getTilePosition(tileNumber);

    const src = getPlayerImageSrc(player.image, player.fame);

    let onSameTileCount = 0;
    board.players.forEach((p, idx) => {
      if (idx < i && p.position % TILE_COUNT === tileNumber) {
        onSameTileCount++;
      }
    });

    const shiftOffset = onSameTileCount > 0 ? Math.ceil(7 / onSameTileCount) : 0;

    return (
      <div
        key={`player-${i}`}
        className="player-wrapper"
        style={{
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + shiftOffset + '%',
        }}
      >
        <div className="player-col">
          <img
            className={
              'player-image' + (player.name == board.activePlayer.name ? ' current-player' : '')
            }
            src={src}
            alt={player.name}
          />
        </div>
      </div>
    );
  };

  // Render nothing until map loaded so BG is first layer and tiles render after it
  if (!mapReady) {
    return (
      <div
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#0000' }}
        id="layerCanvasPlaceholder"
      />
    );
  }

  return (
    <div
      className="board-wrapper"
      style={{ width: CANVAS_WIDTH, height: WRAPPER_HEIGHT }}
      id="layerWrapper"
    >
      <div className="bg-layer">
        <div className="layer-players">{board.players.map((p, i) => renderPlayer(p, i))}</div>

        <div className="layer-tiles" aria-hidden>
          {board.tiles.map((tile, i) => renderTile(tile, i))}
        </div>

        <img className="bg-image" src={mapUrl} alt={'Map bg'}></img>
      </div>
    </div>
  );
};
