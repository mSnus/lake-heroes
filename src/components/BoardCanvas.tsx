import React, { useRef, useEffect } from 'react';
import { Board } from '../game/Board';
import groupsData from '../settings/groups.json';
import mapUrl from '../assets/map5.png';
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
} from './board/common';

interface BoardCanvasProps {
  board: Board;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board }) => {
  // Switch layout for mobile: vertical (6x8) on mobile, horizontal (8x6) otherwise
  const isMobile = isMobileLayout();
  const ratioX = isMobile ? 1.8 : 1;
  const ratioY = isMobile ? 1.2 : 1;
  const boardWidth = isMobile ? 6 : 8; // tiles horizontally
  const boardHeight = isMobile ? 8 : 6; // tiles vertically
  const tileWidth = Math.round(TILE_WIDTH / ratioX);
  const tileHeight = Math.round(TILE_WIDTH / ratioY);
  const titleBarHeight = Math.round(TITLE_BAR_HEIGHT / ratioY);
  const CANVAS_WIDTH = '1024px';
  const CANVAS_HEIGHT = '584px';

  const [mapReady, setMapReady] = React.useState(false);

  // Preload map so tiles render only after background is ready
  useEffect(() => {
    const img = new Image();
    img.src = mapUrl as unknown as string;
    img.onload = () => setMapReady(true);
  }, []);

  // groups lookup
  const groupsByName: Record<string, { name: string; icon: string; color: string }> =
    React.useMemo(() => {
      const map: Record<string, { name: string; icon: string; color: string }> = {};
      (groupsData as any[]).forEach((g: any) => {
        if (g && g.name) map[g.name] = { name: g.name, icon: g.icon, color: g.color };
      });
      return map;
    }, []);

  // Render a single tile as HTML/CSS
  const renderTile = (tile: any, i: number) => {
    const grp = tile?.group ? groupsByName[tile.group] : undefined;
    const hasTitle = !!tile && tile.group !== 'Special';
    const titleStyle: React.CSSProperties = {
      height: titleBarHeight,
      width: tileWidth * 0.8,
      marginLeft: tileWidth * 0.1,
      minHeight: titleBarHeight,
      display: 'flex',
      background: !hasTitle ? 'transparent' : grp?.color || '#EAEAEA',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      font: TITLE_FONT,
    };

    const contentStyle: React.CSSProperties = {
      padding: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      font: BODY_FONT,
      gap: 2,
    };

    // diamonds as small rotated squares tinted by owner color
    const diamonds = [];
    if (tile && tile.owner) {
      const owner = board.players.find((p) => p.name === tile.owner);
      const color = owner?.color || '#444';
      const count = Math.max(0, Math.min(3, tile.level));
      for (let d = 0; d < count; d++) {
        diamonds.push(
          <div
            key={d}
            style={{
              width: DIAMOND_SIZE,
              height: DIAMOND_SIZE,
              background: color,
              transform: 'rotate(45deg)',
              marginLeft: d === 0 ? 0 : DIAMOND_GAP,
            }}
          />
        );
      }
    }

    // players on this tile
    const playersOnTile = board.players.filter((p) => p.position % TILE_COUNT === i);

    const pos = getTilePosition(i);

    return (
      <div
        key={i}
        className="tile"
        style={{
          width: tileWidth,
          height: tileHeight,
          boxSizing: 'border-box',
          border:
            '1px solid ' + tile?.owner
              ? board.players.find((p) => p.name === tile.owner)?.color
              : 'rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: tile?.owner
            ? board.players.find((p) => p.name === tile.owner)?.color + '40'
            : 'rgba(255,255,255,0.2)',
          overflow: 'hidden',
          borderRadius: '100%',
          position: 'absolute',
          top: pos.y + 'px',
          left: pos.x + 'px',
          zIndex: i*10 + 1,
        }}
      >
        <div style={titleStyle}>{i}</div>
        {grp?.icon}

        <div style={contentStyle}>
          {tile?.name &&
            (() => {
              const { emoji, textPart1, textPart2 } = parseTileName(tile.name);
              return (
                <>
                  {emoji && <div style={{ font: EMOJI_FONT }}>{emoji}</div>}
                  {textPart1 && <div>{textPart1}</div>}
                  {textPart2 && <div>{textPart2}</div>}
                </>
              );
            })()}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>{diamonds}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {playersOnTile.map((p) => (
              <div
                key={p.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: p.color,
                    border: '2px solid #fff',
                    position: 'relative',
                    top: 20,
                  }}
                />
                <div style={{ fontSize: 10, color: '#fff' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // grid wrapper style with background map
  const wrapperStyle: React.CSSProperties = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundImage: `url(${mapUrl as unknown as string})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'block',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${boardWidth}, ${tileWidth}px)`,
    gridTemplateRows: `repeat(${boardHeight}, ${tileHeight}px)`,
    gap: 0,
  };

  // Render nothing until map loaded so BG is first layer and tiles render after it
  if (!mapReady) {
    return <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#0000' }} />;
  }

  return (
    <div style={wrapperStyle}>
      {Array.from({ length: TILE_COUNT }).map((_, i) => renderTile(board.tiles[i], i))}
    </div>
  );
};
