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

  const renderPlayer = (player: any, i: number) => {
    const tileNumber = player.position % TILE_COUNT;

    const pos = getTilePosition(tileNumber);

    return (
      <div
        key={i}
        style={{
          display: 'flex',
          gap: 6,
          position: 'absolute',
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + '%',
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
          <div style={{ fontSize: 10, color: '#fff' }}>{player.name}</div>
        </div>
      </div>
    );
  };

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
              marginTop: '-30px',
              background: color,
              transform: 'rotate(45deg)',
              marginLeft: d === 0 ? 0 : DIAMOND_GAP,
              border: 'solid 1px #ffffff55',
            }}
          />
        );
      }
    }

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
            '.0625rem solid ' + tile?.owner
              ? board.players.find((p) => p.name === tile.owner)?.color
              : 'rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'visible',
          filter: 'drop-shadow(2px 4px 6px black)',
          position: 'absolute',
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + '%',
          zIndex: i * 10 + 1,
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

  return (
    <div style={wrapperStyle}>
      {Array.from({ length: TILE_COUNT }).map((_, i) => renderTile(board.tiles[i], i))}
      {Array.from({ length: board.players.length }).map((_, i) =>
        renderPlayer(board.players[i], i)
      )}
      <div style={bgStyle}></div>
    </div>
  );
};
