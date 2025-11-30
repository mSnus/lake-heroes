import React, { useRef, useEffect } from 'react';
import { Board } from '../game/Board';
import groupsData from '../settings/groups.json';
import mapUrlH from '../assets/map-h.png';
import mapUrlV from '../assets/map-v.png';

import {
  TILE_COUNT,
  TILE_WIDTH,
  TITLE_BAR_HEIGHT,
  TITLE_FONT,
  BODY_FONT,
  EMOJI_FONT,
  DIAMOND_SIZE,
  DIAMOND_GAP,
  getTilePosition,
  isMobileLayout,
  parseTileName,
  BODY_MOBILE_FONT,
} from './board/common';

interface BoardCanvasProps {
  board: Board;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  const isMobile = isMobileLayout();
  const ratio = isMobile ? 2 : 1;
  const offsetX = isMobile ? 10 : 0;
  const offsetY = isMobile ? 8 : 0;
  const tileWidth = Math.round(TILE_WIDTH / ratio);
  const tileHeight = Math.round(TILE_WIDTH / ratio);
  const titleBarHeight = Math.round(TITLE_BAR_HEIGHT / ratio);
  const CANVAS_WIDTH = isMobileLayout() ? '100vw' : '64rem';
  const CANVAS_HEIGHT = isMobileLayout() ? '175vw' : '36.5625rem';

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
  // note: useRef is initialized only on first render, subsequent board changes won't overwrite it

  // Static tile renderer (no dynamic owner markers)
  const staticTilesJSX = React.useMemo(
    () => {
      const tiles = initialTilesRef.current || [];
      const renderStaticTile = (tile: any, i: number) => {
        const grp = tile?.group ? groupsByName[tile.group] : undefined;
        const titleStyle: React.CSSProperties = {
          height: titleBarHeight,
          marginLeft: tileWidth * 0.1,
          minHeight: titleBarHeight,
          display: 'flex',
          background: grp?.color || '#EAEAEA',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          padding: '2px 8px',
          font: isMobile ? BODY_MOBILE_FONT : BODY_FONT,
        };

        const contentStyle: React.CSSProperties = {
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          font: isMobile ? BODY_MOBILE_FONT : BODY_FONT,
          gap: 2,
        };

        const pos = getTilePosition(i);

        return (
          <div
            key={`static-${i}`}
            className="tile"
            style={{
              width: tileWidth,
              height: tileHeight,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'visible',
              position: 'absolute',
              top: pos.y - offsetY + '%',
              left: pos.x - offsetX + '%',
              zIndex: 1, // static layer
              pointerEvents: 'none',
            }}
          >
            <div style={contentStyle}>
              {tile?.name &&
                (() => {
                  const { emoji, textPart1, textPart2 } = parseTileName(tile.name);
                  return (
                    <>
                      {emoji && <div style={{ font: EMOJI_FONT }}>{emoji}</div>}
                      {
                        <div style={titleStyle}>
                          {textPart1} {isMobileLayout() ? '' : textPart2}
                        </div>
                      }
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
          style={{
            position: 'absolute',
            top: pos.y - offsetY + '%',
            left: pos.x - offsetX + '%',
            zIndex: 2,
            display: 'flex',
            transform: 'translate(-50%,-10%)',
            gap: DIAMOND_GAP,
            pointerEvents: 'none',
          }}
        >
          {Array.from({ length: count }).map((_, d) => (
            <div
              key={d}
              style={{
                width: DIAMOND_SIZE,
                height: DIAMOND_SIZE,
                background: color,
                transform: 'rotate(45deg)',
                border: 'solid 1px #ffffff55',
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
        style={{
          display: 'flex',
          gap: 6,
          position: 'absolute',
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + '%',
          zIndex: 3,
          pointerEvents: 'auto',
        }}
      >
        <div
          key={player.name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div
            id={`player-${player.name}`}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: player.color,
              border: '.125rem solid #fff',
              position: 'absolute',
              zIndex: 500,
            }}
          />
          <div style={{ fontSize: 10, color: '#fff', marginTop: 22 }}>{player.name}</div>
        </div>
      </div>
    );
  };

  const wrapperStyle: React.CSSProperties = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    display: 'block',
    position: 'relative',
    overflow: 'hidden',
  };

  const bgStyle: React.CSSProperties = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundImage: `url(${mapUrl as unknown as string})`,
    backgroundSize: '110%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'block',
    position: 'relative',
    top: '-9%',
    zIndex: 0,
  };

  // Render nothing until map loaded so BG is first layer and tiles render after it
  if (!mapReady) {
    return <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#0000' }} />;
  }

  console.log('BoardCanvas render', board);

  return (
    <div style={wrapperStyle}>
      {/* Static layer: background image + static tiles (computed once) */}
      <div style={bgStyle} />
      <div
        aria-hidden
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
      >
        {staticTilesJSX}
      </div>

      {/* Dynamic overlays updated on each render */}
      <div
        aria-live="polite"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}
      >
        {renderOwnershipMarkers()}
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 }}>
        {board.players.map((p, i) => renderPlayer(p, i))}
      </div>
    </div>
  );
};
