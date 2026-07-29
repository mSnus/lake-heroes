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
import { challengeDragonFromBoard } from '../actions/fightDragon';

interface BoardCanvasProps {
  board: GameState;
  updateGameState: (board: GameState) => void;
}

// Camera: 2x, centered on the active player, while it's their turn. On a
// turn change it zooms out to 1x, pauses, then zooms back in on whoever's
// turn it is now — see the zoomLevel effect below.
const ZOOM_SCALE = 2;
const ZOOM_TRANSITION_MS = 600;
const ZOOM_OUT_PAUSE_MS = 400;
// .layer-players sits `top: 46px` inside .bg-layer (see Board.css) — baked
// into the centering math so the camera targets the player marker itself,
// not the tile's own (slightly higher) anchor point.
const PLAYER_LAYER_TOP_OFFSET_PX = 46;

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

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const bgLayerRef = React.useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = React.useState<1 | 2>(1);
  const [resizeTick, setResizeTick] = React.useState(0);

  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Zoom out on a turn change, pause at 1x, then zoom back in on whoever's
  // active now. Also plays once on mount (zooms in on the opening player).
  const activePlayerId = board.activePlayer.id;
  useEffect(() => {
    setZoomLevel(1);
    const t = setTimeout(() => setZoomLevel(2), ZOOM_TRANSITION_MS + ZOOM_OUT_PAUSE_MS);
    return () => clearTimeout(t);
  }, [activePlayerId]);

  // Recomputed every render (cheap arithmetic) so the camera keeps tracking
  // the active player as they move step-by-step during their turn. Reads
  // offsetWidth/Height (layout-based) rather than getBoundingClientRect
  // (paint-based) so it isn't circularly affected by the transform it's computing.
  const zoomTransform = React.useMemo(() => {
    if (zoomLevel === 1) return 'none';
    const layerEl = bgLayerRef.current;
    const wrapperEl = wrapperRef.current;
    if (!layerEl || !wrapperEl) return 'none';

    const layerW = layerEl.offsetWidth;
    const layerH = layerEl.offsetHeight;
    const wrapperW = wrapperEl.offsetWidth;
    const wrapperH = wrapperEl.offsetHeight;
    if (!layerW || !layerH || !wrapperW || !wrapperH) return 'none';

    const activeTileNumber = board.activePlayer.position % TILE_COUNT;
    const activePos = getTilePosition(activeTileNumber);
    const localX = ((activePos.x - offsetX) / 100) * layerW;
    const localY = PLAYER_LAYER_TOP_OFFSET_PX + ((activePos.y - offsetY) / 100) * layerH;

    let dx = wrapperW / 2 - localX * ZOOM_SCALE;
    let dy = wrapperH / 2 - localY * ZOOM_SCALE;

    // Clamp so zooming near an edge never reveals empty space beyond the
    // map — only on axes where the scaled map is actually big enough to
    // fill the viewport (it already doesn't on some layouts at 1x).
    const scaledW = layerW * ZOOM_SCALE;
    const scaledH = layerH * ZOOM_SCALE;
    dx = scaledW > wrapperW ? Math.min(0, Math.max(wrapperW - scaledW, dx)) : Math.min(0, dx);
    dy = scaledH > wrapperH ? Math.min(0, Math.max(wrapperH - scaledH, dy)) : Math.min(0, dy);

    return `translate(${dx}px, ${dy}px) scale(${ZOOM_SCALE})`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomLevel, board.activePlayer.position, offsetX, offsetY, resizeTick, mapReady]);

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

    const owner = tile.owner ? board.players.find((p) => p.id === tile.owner) : null;
    const ownerColor = owner?.color || '#444';
    const ownerShadow = tile.isOwned() ? ownerColor + ' 0px 0px 0px 4px inset' : 'none';

    return (
      <div
        key={`tile-${i}`}
        className={tileClass}
        style={{
          top: pos.y - offsetY + '%',
          left: pos.x - offsetX + '%',
          ...(isMapEditSelected
            ? { outline: '3px solid yellow', outlineOffset: '2px', zIndex: 999 }
            : {}),
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
                            ? undefined
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
        onClick={(e) => {
          e.stopPropagation();
          gameEvent('displayPlayer', player);
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
      ref={wrapperRef}
    >
      <div
        className="bg-layer"
        ref={bgLayerRef}
        style={{
          transform: zoomTransform,
          transformOrigin: '0 0',
          transition: `transform ${ZOOM_TRANSITION_MS}ms ease`,
        }}
      >
        <div className="layer-players">{board.players.map((p, i) => renderPlayer(p, i))}</div>

        <div className="layer-tiles" aria-hidden>
          {board.tiles.map((tile, i) => renderTile(tile, i))}
        </div>

        <div
          className="dragon-center-icon"
          role="button"
          aria-label="Challenge the Dragon"
          onClick={() => challengeDragonFromBoard(board, updateGameState)}
        />

        <img className="bg-image" src={mapUrl} alt={'Map bg'}></img>
      </div>
    </div>
  );
};
