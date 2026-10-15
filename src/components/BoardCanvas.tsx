import React, { useEffect } from 'react';
import { GameState } from '../game/GameState';
import groupsData from '../settings/groups.json';

import { TILE_COUNT, FORK_START_INDEX, TILE_LEVEL_SCALE, REAL_ADVENTURE_MIN_TURNS } from '../game/constants';
import { currentYear } from '../game/year';
import { getTilePosition, isMobileLayout, parseTileName } from './board/common';
import { useMapEditStore, mapEditSelectTile, mapEditSelectPlayerIcon, mapEditDragTile, playerIconOffset, playerIconOffsetH } from '../utils/mapEditStore';
import { useForkChoice, setForkChoice } from '../utils/forkChoiceStore';
import { startDiceRoll } from '../utils/diceStore';
import '../styles/Board.css';
import { getPlayerImageSrc } from '../game/PlayerOptions';
import { gameEvent } from '../utils/events';
import { sayLocal } from '../utils/say';
import { useRemoteMove } from '../online/remoteMoveStore';
import { seatIndex } from '../game/seats';
import { showScreen } from '../utils/screenStore';
import RealmOverviewScreen from './RealmOverviewScreen';
import { handleKingCastle } from '../actions/king';
import { openTavernHireOnly } from '../actions/tavern';
import { openStablesHireOnly } from '../actions/stables';
import { challengeDragonFromBoard } from '../actions/fightDragon';
import { useT } from '../i18n';

interface BoardCanvasProps {
  board: GameState;
  updateGameState: (board: GameState) => void;
}

// Camera: ZOOM_SCALE, centered on the active player, while it's their turn.
// On a turn change it zooms out to 1x, pauses, then zooms back in on
// whoever's turn it is now — see the zoomLevel effect below.
const ZOOM_SCALE = 1.33;
const ZOOM_TRANSITION_MS = 600;
const ZOOM_OUT_PAUSE_MS = 400;

const PLAYER_CLUSTER_COLUMNS = 2;

// Fork picker arrow look, shared with TurnAnnouncement's own left/right
// buttons (see showForkChoice/renderForkChoice below) so both pickers read
// as the same visual language.
export const SELECTED_COLOR = '#e6cc68';
const UNSELECTED_COLOR = '#81a585ad';
export const ANGLE_LEFT = 135; // short path
export const ANGLE_RIGHT = 57; // long path

/** Small non-overlapping grid offset (in % of the board) for the `index`-th
 * of `count` players sharing a tile, centered on the anchor point rather
 * than trailing off to one side. */
function clusterOffset(index: number, count: number, stepPct: number): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 };
  const columns = Math.min(PLAYER_CLUSTER_COLUMNS, count);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const rows = Math.ceil(count / columns);
  const dx = (col - (columns - 1) / 2) * stepPct;
  const dy = (row - (rows - 1) / 2) * stepPct;
  return { dx, dy };
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({ board, updateGameState }) => {
  const t = useT();
  const isMobile = isMobileLayout();
  const mapEdit = useMapEditStore();
  const forkChoice = useForkChoice();
  const remoteMove = useRemoteMove();

  // While a remote player's move is being replayed hop-by-hop (see
  // online/remoteMoveStore.ts), render THEIR token at the replayed position
  // instead of the board's own (already-final) player.position -- every
  // other player renders at their real position as always.
  const displayPosition = (p: any) =>
    remoteMove && remoteMove.seat === seatIndex(p) ? remoteMove.position : p.position;

  const [mapReady, setMapReady] = React.useState(false);
  const mapUrl = 'assets/map13.jpg';

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

  // Map-edit tile drag: pointer position and the tile's own %-position at
  // drag start, so every subsequent pointermove can compute an absolute new
  // position from the pointer's total movement (measured against bg-layer's
  // own rendered size, which already accounts for the zoom transform).
  const tileDragRef = React.useRef<{ index: number; startClientX: number; startClientY: number; startXPct: number; startYPct: number } | null>(null);

  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Zoom out on a turn change, pause at 1x, then zoom back in on whoever's
  // active now. Also plays once on mount (zooms in on the opening player).
  // Skipped when the new active player is already standing on the same tile
  // as the previous one — there's nowhere new to pan to, so zooming out and
  // straight back in would just be a pointless flicker.
  const activePlayerId = board.activePlayer.id;
  const lastZoomPositionRef = React.useRef<number | null>(null);

  //set to 1 to disable zoom, 2 to normal zoom-in
  const ZOOM_MAX_LEVEL = 2;

  useEffect(() => {
    const newPosition = board.activePlayer.position;
    const samePosition = lastZoomPositionRef.current === newPosition;
    lastZoomPositionRef.current = newPosition;

    if (samePosition) {
      setZoomLevel(ZOOM_MAX_LEVEL);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setZoomLevel(1);
    const t = setTimeout(() => {
      setZoomLevel(ZOOM_MAX_LEVEL);
      // Zooming in centers the camera on the active player -- scroll the
      // page up first so that zoomed-in view is actually visible instead of
      // landing off-screen below wherever the page happened to be scrolled.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, ZOOM_TRANSITION_MS + ZOOM_OUT_PAUSE_MS);
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
    const localX = (activePos.x / 100) * layerW;
    const localY = (activePos.y / 100) * layerH;

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
  }, [zoomLevel, board.activePlayer.position, resizeTick, mapReady]);

  // Manual zoom-out: double-clicking the map itself (not a tile or the
  // dragon island, which have their own click handlers) resets to 1x even
  // mid-turn. The auto zoom-in-on-turn-change effect only re-fires on an
  // activePlayerId change, so this stays put until the next turn.
  const handleBoardDoubleClick = (e: React.MouseEvent) => {
    if (zoomLevel !== 2) return;
    const target = e.target as HTMLElement;
    if (target.closest('.tile, .dragon-center-icon')) return;
    setZoomLevel(1);
  };

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
      if (tile.id === 'king-castle') {
        // Standing on it opens the Castle itself; from anywhere else the
        // King's Castle is just where you go to survey the realm.
        if (isActivePlayerTile) handleKingCastle(board, updateGameState);
        else showScreen({ content: <RealmOverviewScreen gameState={board} /> });
        return;
      }

      if (isActivePlayerTile && tile.id === 'tavern') {
        openTavernHireOnly(board, updateGameState);
        return;
      }

      if (isActivePlayerTile && tile.id === 'stables') {
        openStablesHireOnly(board, updateGameState);
        return;
      }

      // Special (non-ownable) tiles have nothing to own/garrison/upgrade --
      // the card would just be an empty frame around the sprite. A local
      // toast of its flavor text instead, and close the card if one was
      // already open from clicking a different tile. Local only: nobody
      // else cares that this browser is inspecting a tile.
      if (!tile.isOwnable) {
        if (!tile.fogged() && tile.description) {
          sayLocal(tile.description, 'info');
        }

        gameEvent('displayTile', {});
        return;
      }

      gameEvent('displayTile', tile.fogged() ? {} : tile);
    };

    const isMapEditSelected =
      mapEdit.active && mapEdit.target?.kind === 'tile' && mapEdit.target.index === i;

    // Map-edit drag: mousedown starts tracking, every subsequent move turns
    // the pointer's total on-screen movement into a %-of-board delta (via
    // bg-layer's own rendered size, which already reflects the zoom
    // transform) and writes it straight through to the tile's position.
    // Pointer capture keeps move/up events targeting this tile even once
    // the cursor strays outside it mid-drag.
    const handleTilePointerDown = (e: React.PointerEvent) => {
      if (!mapEdit.active) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      tileDragRef.current = {
        index: i,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: pos.x,
        startYPct: pos.y,
      };
    };

    const handleTilePointerMove = (e: React.PointerEvent) => {
      const drag = tileDragRef.current;
      if (!drag || drag.index !== i) return;
      const rect = bgLayerRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;
      mapEditDragTile(i, drag.startXPct + dxPct, drag.startYPct + dyPct);
    };

    const handleTilePointerUp = (e: React.PointerEvent) => {
      if (tileDragRef.current?.index !== i) return;
      tileDragRef.current = null;
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    };

    const isFogged = tile.fogged();
    const isOnFire = tile.isOnFire(board.round);
    const ownedClass = tile.isOwned() ? 'tile-sprite-owned' : 'tile-sprite-unowned';

    const owner = tile.owner ? board.players.find((p) => p.id === tile.owner) : null;
    const ownerColor = owner?.color || '#444';
    const ownerShadow = tile.isOwned() ? ownerColor + ' 0px 0px 0px 4px inset' : 'none';

    return (
      <div
        key={`tile-${i}`}
        className={tileClass}
        style={{
          top: pos.y + '%',
          left: pos.x + '%',
          ...(mapEdit.active
            ? { cursor: tileDragRef.current?.index === i ? 'grabbing' : 'grab', touchAction: 'none' }
            : {}),
          ...(isMapEditSelected
            ? { outline: '3px solid yellow', outlineOffset: '2px', zIndex: 999 }
            : {}),
          ...(isOnFire ? { filter: 'grayscale(0.5)' } : {}),
        }}
        onClick={handleTileClick}
        onPointerDown={handleTilePointerDown}
        onPointerMove={handleTilePointerMove}
        onPointerUp={handleTilePointerUp}
      >
        {isMapEditSelected && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 900,
              color: 'red',
              textShadow: '0 0 4px #000, 0 0 4px #000, 0 0 4px #000',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            {i}
          </div>
        )}
        <div className="tile-content">
          {tile?.name &&
            (() => {
              const { textPart1, textPart2 } = parseTileName(tile.name);
              const isKingTile = tile.id === 'king-castle';
              const tileSizeClass = ['king-castle'].includes(tile.id)
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
                      {tile.shortName}
                    </div>
                  )}
                  {(tile.spriteImage || isFogged) && (
                    <div
                      className={tileSizeClass}
                      // Only ownable tiles have a level; specials stay full size.
                      style={
                        tile.isOwnable
                          ? {
                              transform: `scale(${TILE_LEVEL_SCALE[tile.level] ?? 1})`,
                              transition: 'transform 0.4s ease',
                            }
                          : undefined
                      }
                    >
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

  const cellStyleFor = (pos: { x: number; y: number }): React.CSSProperties => ({
    top: pos.y + '%',
    left: pos.x + '%',
  });

  // Purely decorative per-tile effect that sits above everything else on the
  // board (tiles, players) but doesn't intercept clicks -- at most one at a
  // time, in priority order: still-smoldering 🔥 (on top of the grayscale
  // filter renderTile applies to the tile itself -- a smoldering tile can't
  // be attacked/claimed regardless of any abandoned/zombie garrison it also
  // has, so that's the one that should read as the tile's actual state),
  // then abandoned/zombie-guarded 🧟‍♀️, then yielded-to-the-King 👑. Add more
  // overlay kinds to this same layer/function rather than bolting them onto
  // renderTile directly.
  const renderOverlay = (tile: any, i: number) => {
    const pos = getTilePosition(i);
    const emoji = tile.isOnFire(board.round) ? '🔥' : tile.abandoned ? '🧟‍♀️' : tile.isYielded ? '👑' : null;
    if (!emoji) return null;
    return (
      <div key={`overlay-${i}`} className="tile-emoji-overlay" style={cellStyleFor(pos)}>
        {emoji}
      </div>
    );
  };

  const renderPlayer = (player: any, i: number) => {
    const tileNumber = displayPosition(player) % TILE_COUNT;
    const pos = getTilePosition(tileNumber);

    const src = getPlayerImageSrc(player.image, player.isKnight);

    // Tiles with their title laid out to the side (textPos 'left'/'right')
    // need their own anchor offset -- the art sits differently within the
    // tile box than a normal (title-below) tile.
    const offset = pos.textPos === 'left' || pos.textPos === 'right' ? playerIconOffsetH : playerIconOffset;

    const sameTilePlayers = board.players
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => displayPosition(p) % TILE_COUNT === tileNumber);
    const indexInCluster = sameTilePlayers.findIndex(({ idx }) => idx === i);
    const { dx, dy } = clusterOffset(indexInCluster, sameTilePlayers.length, offset.clusterStepPct);

    const isPlayerIconEditSelected = mapEdit.active && mapEdit.target?.kind === 'player-icon';

    return (
      <div
        key={`player-${i}`}
        className="player-wrapper"
        style={{
          top: pos.y + offset.anchorYPct + dy + '%',
          left: pos.x + offset.anchorXPct + dx + '%',
          ...(isPlayerIconEditSelected
            ? { outline: '3px solid yellow', outlineOffset: '2px', zIndex: 999 }
            : {}),
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (mapEdit.active) {
            mapEditSelectPlayerIcon();
            return;
          }

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

  // Fork path picker (map13): shown only while the active player is a human
  // actually standing on the fork's start tile, about to roll -- disappears
  // the instant a roll begins (turnPhase leaves 'before-move'), matching the
  // "choose before rolling" requirement. The choice itself lives in
  // forkChoiceStore, read once by rollAndMove.ts right before movement.
  // Hidden entirely early on (see REAL_ADVENTURE_MIN_TURNS) -- rollAndMove
  // forces the short path regardless then, so showing a choice that doesn't
  // do anything would just be confusing.
  const showForkChoice =
    !board.activePlayer.isComputer &&
    board.turnPhase === 'before-move' &&
    board.activePlayer.position === FORK_START_INDEX &&
    currentYear(board) > REAL_ADVENTURE_MIN_TURNS;

  const renderForkChoice = () => {
    const pos = getTilePosition(FORK_START_INDEX);

    const arrowStyle = (rotation: number, color: string, offsetXPct: number, offsetYPct: number = 0): React.CSSProperties => ({
      top: pos.y + offsetYPct + '%',
      left: pos.x + offsetXPct + '%',
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      color,
    });

    return (
      <>
        <div
          className="fork-arrow"
          style={arrowStyle(ANGLE_LEFT, forkChoice === 'short' ? SELECTED_COLOR : UNSELECTED_COLOR, -1)}
          onClick={(e) => {
            e.stopPropagation();
            setForkChoice('short');
            // Picking a path is also the roll -- startDiceRoll is a no-op
            // if the dice modal isn't already open and waiting (it always
            // is here: showForkChoice itself requires 'before-move'), so
            // this is safe to call unconditionally.
            startDiceRoll();
          }}
        >
          ➜
        </div>
        <div
          className="fork-arrow"
          style={arrowStyle(ANGLE_RIGHT, forkChoice === 'long' ? SELECTED_COLOR : UNSELECTED_COLOR, 14, 1)}
          onClick={(e) => {
            e.stopPropagation();
            setForkChoice('long');
            startDiceRoll();
          }}
        >
          ➜
        </div>
      </>
    );
  };

  // Render nothing until map loaded so BG is first layer and tiles render after it
  if (!mapReady) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0000' }} id="layerCanvasPlaceholder" />
    );
  }

  return (
    <div
      className="board-wrapper"
      id="layerWrapper"
      ref={wrapperRef}
      onDoubleClick={handleBoardDoubleClick}
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

        <div className="layer-overlays" aria-hidden>
          {board.tiles.map((tile, i) => renderOverlay(tile, i))}
        </div>

        {showForkChoice && <div className="layer-fork-choice">{renderForkChoice()}</div>}

        <div
          className="dragon-center-icon"
          role="button"
          aria-label={t('boardCanvas.challengeDragon')}
          onClick={() => challengeDragonFromBoard(board, updateGameState)}
        />

        <img className="bg-image" src={mapUrl} alt={'Map bg'}></img>
      </div>
    </div>
  );
};
