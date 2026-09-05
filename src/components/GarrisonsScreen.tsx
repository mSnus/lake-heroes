import React, { useState } from 'react';
import { Player } from '../game/Player';
import { GameState } from '../game/GameState';
import { Tile } from '../game/Tile';
import { ScreenBackground } from './ScreenBackground';
import { SpriteCircleIcon } from './SpriteCircleIcon';
import { DecoratedButton } from './DecoratedButton';
import { DecoratedSlider } from './DecoratedSlider';
import { clearScreen } from '../utils/screenStore';
import { setTileGarrison } from '../actions/garrisonTile';
import { dismountSquad, dismountRefund, snapDismount } from '../actions/dismountSquad';
import { playerTurnIncome } from '../game/income';
import { remainingCapacity, garrisonSlotCapacity } from '../game/army';
import { getOverrides } from '../utils/overridesStore';
import { useT } from '../i18n';
import '../styles/TileCard.css';
import '../styles/TileClaim.css';
import '../styles/GameMenu.css';
import '../styles/GarrisonsScreen.css';
import { Fade } from './Fade';

interface GarrisonsScreenProps {
  gameState: GameState;
  player: Player;
  updateGameState: (board: GameState) => void;
}

/** A tile's absolute militia ceiling -- independent of the shared army pool
 * (see GarrisonsScreen's own doc comment), same math as TileClaimScreen's
 * maxGarrison minus its extra pool-sized Math.min. */
function maxMilitiaFor(tile: Tile): number {
  return (
    tile.garrisonMilitia +
    remainingCapacity(tile.garrisonMilitia, tile.garrisonRiders, tile.garrisonSlots, 'militia', garrisonSlotCapacity())
  );
}


export const GarrisonsScreen: React.FC<GarrisonsScreenProps> = ({ gameState, player, updateGameState }) => {
  const t = useT();

  // Tile has no board-index field of its own -- `idx` (into gameState.tiles,
  // same as player.ownedTiles) is what identifies a row/state entry.
  const rows = player.ownedTiles
    .map((idx) => ({ idx, tile: gameState.tiles[idx] }))
    .filter((r): r is { idx: number; tile: Tile } => !!r.tile && !r.tile.isYielded);

  const [targets, setTargets] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    for (const { idx, tile } of rows) initial[idx] = tile.garrisonMilitia;
    return initial;
  });

  // How many riders the dismount slider is currently offering to convert.
  // dismountSquad mutates `player` in place, so a committed dismount needs a
  // forced re-render to redraw the army line and every row's headroom.
  const [dismount, setDismount] = useState(0);
  const [, forceRerender] = useState(0);
  // Snapped, because the legal counts have a hole in the middle -- see
  // dismountSquad.ts's legalDismounts.
  const dismountPick = snapDismount(player.militia, player.riders, player.armySlots, dismount);

  const handleDismount = () => {
    dismountSquad(gameState, dismountPick, updateGameState);
    setDismount(0);
    forceRerender((v) => v + 1);
  };

  const totalPool = player.militia + rows.reduce((sum, { tile }) => sum + tile.garrisonMilitia, 0);
  const allocated = rows.reduce((sum, { idx, tile }) => sum + (targets[idx] ?? tile.garrisonMilitia), 0);
  const unassigned = totalPool - allocated;
  const turnIncome = playerTurnIncome(gameState, player);

  const setRowValue = (idx: number, value: number) =>
    setTargets((prev) => ({ ...prev, [idx]: value }));

  const handleApply = () => {
    // Current tile first -- a decrease there is the only row that can free
    // units for the others' increases to actually draw from in this pass.
    const ordered = [...rows].sort((a, b) =>
      a.tile === gameState.activeTile ? -1 : b.tile === gameState.activeTile ? 1 : 0
    );
    for (const { idx, tile } of ordered) {
      const target = targets[idx] ?? tile.garrisonMilitia;
      if (target !== tile.garrisonMilitia) setTileGarrison(gameState, player, tile, target);
    }

    updateGameState(gameState);
    clearScreen();
  };

  return (
    <ScreenBackground image="assets/screens/guards.jpg" style={{ paddingTop: '1rem', justifyContent: 'space-evenly' }}>
      <div className="text-title" style={{ marginBottom: '0' }}>
        {t('garrisonsScreen.title')}
      </div>

      <div className="army-stats" style={{ lineHeight: '1.2' }}>
        {t('garrisonsScreen.message', {
          fame: player.fame,
          slots: player.armySlots,
          perSlot: getOverrides().armySlotCapacity,
          units: turnIncome.units,
          tiles: rows.length,
        })}
      </div>

      <div className="garrisons-army">
        <div className="garrisons-army-side">{unassigned + dismountPick}🧍</div>

        {player.riders > 0 ? (
          <>
            <DecoratedSlider
              min={0}
              max={player.riders}
              value={dismountPick}
              onPreview={setDismount}
              onCommit={setDismount}
            />
            <div className="garrisons-army-side">{player.riders - dismountPick}🐎</div>
            <DecoratedButton
              className="decorated-inline"
              disabled={dismountPick <= 0}
              onClick={handleDismount}
            >
              {t('garrisonsScreen.dismount', { gold: dismountRefund(dismountPick) })}
            </DecoratedButton>
          </>
        ) : (
          <div className="garrisons-army-side">{player.riders}🐎</div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-message">{t('garrisonsScreen.noTiles')}</div>
      ) : (
        <div className="garrisons-list">
          {rows.map(({ idx, tile }) => {
            const isCurrentTile = gameState.activeTile === tile;
            const min = isCurrentTile ? 0 : tile.garrisonMilitia;
            const max = Math.max(min, maxMilitiaFor(tile));
            const value = targets[idx] ?? tile.garrisonMilitia;
            const atMax = !isCurrentTile && tile.garrisonMilitia >= max;
            // How far the thumb can actually be dragged -- the pool left
            // once every OTHER row's current pick is subtracted, else rows
            // could each max out independently and push "in the army"
            // negative. Excludes this row's own value so dragging it
            // doesn't shrink its own headroom.
            const liveMax = Math.max(min, Math.min(max, totalPool - (allocated - value)));

            return (
              <React.Fragment key={idx}>
                {tile.spriteImage && <SpriteCircleIcon src={tile.spriteImage} size="3rem" style={{ marginBottom: 0 }} />}

                <div className="garrisons-row-name">{tile.shortName}</div>

                <div className="big-icon-hint towers-max">
                  <div className="garrison-towers">🏯{tile.garrisonSlots}</div>
                  <div style={{color: 'wheat'}}>{t('garrisonsScreen.maxLabel', { max })}</div>
                </div>

                <div className="garrisons-row-info">
                  {atMax ? (
                    <div className="garrisons-row-atmax">
                      {t('garrisonsScreen.atMax', { slots: tile.garrisonSlots, units: tile.garrisonMilitia })}
                    </div>
                  ) : (
                    <DecoratedSlider
                      min={min}
                      max={max}
                      maxPosition={liveMax}
                      value={value}
                      onPreview={(v) => setRowValue(idx, v)}
                      onCommit={(v) => setRowValue(idx, v)}
                    />
                  )}
                </div>

                <div className="garrisons-row-value">
                  <div>{value}🧍</div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="game-menu pay-or-fight-grid">
        <DecoratedButton onClick={() => clearScreen()}>{t('garrisonsScreen.neverMind')}</DecoratedButton>
        <DecoratedButton onClick={handleApply}>{t('garrisonsScreen.setGuards')}</DecoratedButton>
      </div>

      <Fade />
    </ScreenBackground>
    
  );
};

export default GarrisonsScreen;
