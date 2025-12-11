import React, { useRef, useEffect, ReactElement } from 'react';
import { GameState } from '../game/GameState';
import { SPRITE_SIZE } from './board/common';
import groupsData from '../settings/groups.json';

import {
  TILE_COUNT,
  DIAMOND_SIZE,
  DIAMOND_GAP,
  getTilePosition,
  isMobileLayout,
  parseTileName,
} from './board/common';
import '../styles/Board.css';
import { playerImageAssets } from '../game/PlayerOptions';

interface BoardCanvasProps {
  board: GameState;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  const isMobile = isMobileLayout();

  const offsetX = isMobile ? 10 : 0;
  const offsetY = isMobile ? 8 : 0;

  const CANVAS_WIDTH = isMobileLayout() ? '100vw' : '64rem';
  const CANVAS_HEIGHT = isMobileLayout() ? '120vw' : '36.5625rem';
  const WRAPPER_HEIGHT = isMobileLayout() ? '115vw' : CANVAS_HEIGHT;

  const [mapReady, setMapReady] = React.useState(false);
  const mapUrl = 'assets/map10.jpg';

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

  // Capture initial tiles once so static portion never re-renders when `board` changes
  const initialTilesRef = useRef<any[] | null>(board.tiles || null);

  // Static tile renderer
  const staticTilesJSX = React.useMemo(
    () => {
      const tiles = initialTilesRef.current || [];
      const renderStaticTile = (tile: any, i: number) => {
        const grp = tile?.group ? groupsByName[tile.group] : undefined;

        const pos = getTilePosition(i);
        let titleClass = 'tile';
        if (pos?.textPos === 'left') titleClass += ' tile-left';
        if (pos?.textPos === 'right') titleClass += ' tile-right';

        // Add click handler to make tiles interactive
        const handleTileClick = () => {
          if (tile) {
            window.dispatchEvent(new CustomEvent('displayTitle', { detail: tile }));
          }
        };

        return (
          <div
            key={`static-${i}`}
            className={titleClass}
            style={{
              top: pos.y - offsetY + '%',
              left: pos.x - offsetX + '%',
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
                      {!isKingTile && (
                        <div
                          className="tile-title"
                          style={{
                            color: grp?.color || '#FFF',
                          }}
                        >
                          {textPart1} {isMobileLayout() ? '' : textPart2}
                        </div>
                      )}
                      {tile.sprite && (
                        <div className={tileSizeClass}>
                          <div
                            className="tile-sprite"
                            style={{
                              backgroundImage: `url(assets/sprites2.png)`,
                              backgroundPositionX: `-${tile.sprite.x * SPRITE_SIZE}px`,
                              backgroundPositionY: `-${tile.sprite.y * SPRITE_SIZE}px`,
                            }}
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

      return Array.from({ length: TILE_COUNT }).map((_, i) => renderStaticTile(tiles[i], i));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      /* empty: compute once */
    ]
  );

  // Dynamic ownership markers (diamonds) and player markers are rendered from current board
  const renderOwnershipMarkers = () => {
    const markers: ReactElement[] = [];
    (board.tiles || []).forEach((tile: any, i: number) => {
      if (!tile || !tile.owner) return;
      const owner = board.players.find((p) => p.name === tile.owner);
      const color = owner?.color || '#444';
      const count = Math.max(0, Math.min(3, tile.level || 1));

      const pos = getTilePosition(i);
      // container positioned at tile center; diamonds arranged horizontally
      markers.push(
        <div
          key={`marker-${i}`}
          className="diamond-container"
          style={{
            top: pos.y - offsetY + '%',
            left: pos.x - offsetX + '%',
            gap: DIAMOND_GAP,
          }}
        >
          {Array.from({ length: count }).map((_, d) => (
            <div
              key={d}
              className="diamond"
              style={{
                background: color,
                width: DIAMOND_SIZE,
                height: DIAMOND_SIZE,
              }}
            ></div>
          ))}
        </div>
      );
    });
    return markers;
  };

  const renderPlayer = (player: any, i: number) => {
    const tileNumber = player.position % TILE_COUNT;
    const pos = getTilePosition(tileNumber);

    const src = playerImageAssets[player.image] || 'assets/players/default.png';

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
          <img className="player-image" src={src} alt={player.name} />
          <div
            id={`player-${player.name}`}
            className="player-marker"
            style={{
              background: `${player.color}`,
            }}
          />
          <div className="player-name">{player.name}</div>
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
        <div className="layer-diamonds" aria-live="polite">
          {renderOwnershipMarkers()}
        </div>

        <div className="layer-players">{board.players.map((p, i) => renderPlayer(p, i))}</div>

        <div className="layer-tiles" aria-hidden>
          {staticTilesJSX}
        </div>

        <img className="bg-image" src={mapUrl} alt={'Map bg'}></img>
      </div>
    </div>
  );
};
