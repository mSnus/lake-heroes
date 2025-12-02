import React, { useRef, useEffect } from 'react';
import { GameState } from '../game/GameState';
import groupsData from '../settings/groups.json';
import mapUrlH from '../assets/map-h.png';
import mapUrlV from '../assets/map-v.png';

import {
  TILE_COUNT,
  TILE_WIDTH,
  TITLE_BAR_HEIGHT,
  BODY_FONT,
  DIAMOND_SIZE,
  DIAMOND_GAP,
  getTilePosition,
  isMobileLayout,
  parseTileName,
  BODY_MOBILE_FONT,
} from './board/common';
import '../styles/Board.css';

interface GameStateCanvasProps {
  board: GameState;
}

export const GameStateCanvas: React.FC<GameStateCanvasProps> = ({ board }) => {
  const isMobile = isMobileLayout();

  const ratio = isMobile ? 2 : 1;

  const offsetX = isMobile ? 10 : 0;
  const offsetY = isMobile ? 8 : 0;

  const titleBarHeight = Math.round(TITLE_BAR_HEIGHT / ratio);

  const CANVAS_WIDTH = isMobileLayout() ? '100vw' : '64rem';
  const CANVAS_HEIGHT = isMobileLayout() ? '120vw' : '36.5625rem';
  const WRAPPER_HEIGHT = isMobileLayout() ? '115vw' : CANVAS_HEIGHT;

  const [mapReady, setMapReady] = React.useState(false);
  const mapUrl = isMobile ? (mapUrlV as unknown as string) : (mapUrlH as unknown as string);

  // Preload map so tiles render only after background is ready
  useEffect(() => {
    const img = new Image();
    img.src = isMobile ? (mapUrlV as unknown as string) : (mapUrlH as unknown as string);
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
            window.dispatchEvent(
              new CustomEvent('tileClicked', { detail: { tileIndex: i, tile } })
            );
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
                  const { emoji, textPart1, textPart2 } = parseTileName(tile.name);
                  const isKingTile = textPart1?.substr(0, 4) === 'King';
                  const emojiClass = isKingTile ? 'title-emoji-big' : 'tile-emoji';

                  return (
                    <>
                      {!isKingTile && (
                        <div
                          className="tile-title"
                          style={{
                            height: titleBarHeight,
                            font: isMobile ? BODY_MOBILE_FONT : BODY_FONT,
                            color: grp?.color || '#FFF',
                          }}
                        >
                          {textPart1} {isMobileLayout() ? '' : textPart2}
                        </div>
                      )}
                      {emoji && <div className={emojiClass}>{emoji}</div>}
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
    const markers: JSX.Element[] = [];
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
            />
          ))}
        </div>
      );
    });
    return markers;
  };

  const renderPlayer = (player: any, i: number) => {
    const tileNumber = player.position % TILE_COUNT;
    const pos = getTilePosition(tileNumber);
    return (
      <div
        key={`player-${i}`}
        className="player-wrapper"
        style={{
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + '%',
        }}
      >
        <div className="player-col">
          <div
            id={`player-${player.name}`}
            className="player-marker"
            style={{
              background: player.color,
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

        <img className="bg-image" src={mapUrl as string}></img>
      </div>
    </div>
  );
};
