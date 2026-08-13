import React, { useState } from 'react';
import { GameState } from '../game/GameState';
import { clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
import { DecoratedButton } from './DecoratedButton';
import { getOverrides } from '../utils/overridesStore';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';

// Generous safety ceilings for values with no real in-game maximum, so the
// number inputs still have a sane bound.
const GOLD_CAP = 999999;
const FAME_CAP = 99;

interface CheatScreenProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

interface TileOption {
  index: number;
  name: string;
}

/** Ownable tiles first (alphabetical), then special tiles (alphabetical). */
function buildTileOptions(board: GameState): TileOption[] {
  const ownable: TileOption[] = [];
  const special: TileOption[] = [];
  board.tiles.forEach((tile, index) => {
    if (!tile) return;
    (tile.isOwnable ? ownable : special).push({ index, name: tile.name });
  });
  ownable.sort((a, b) => a.name.localeCompare(b.name));
  special.sort((a, b) => a.name.localeCompare(b.name));
  return [...ownable, ...special];
}

const CheatScreen: React.FC<CheatScreenProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const player = gameState.activePlayer;

  // Forces a fresh render after mutating `player`/tiles in place, so caps
  // that depend on the player's current state (e.g. unit capacity after a
  // fame change) stay accurate between one cheat action and the next.
  const [, setTick] = useState(0);
  const refresh = () => {
    updateGameState(gameState);
    setTick((v) => v + 1);
  };

  const tileOptions = buildTileOptions(gameState);
  const unitCap = getOverrides().garrisonCapacity * player.armySlots;

  const [moveIdx, setMoveIdx] = useState(tileOptions[0]?.index ?? 0);
  const [ownIdx, setOwnIdx] = useState(tileOptions[0]?.index ?? 0);
  const [gold, setGold] = useState(player.gold);
  const [militia, setMilitia] = useState(player.militia);
  const [riders, setRiders] = useState(player.riders);
  const [fame, setFame] = useState(player.fame);

  const handleMove = () => {
    const tile = gameState.tiles[moveIdx];
    if (!tile) return;
    player.position = moveIdx;
    tile.fog = false;
    gameEvent('displayTile', tile);
    refresh();
  };

  const handleOwn = () => {
    const tile = gameState.tiles[ownIdx];
    if (!tile || !tile.isOwnable) return;
    gameState.players.forEach((p) => {
      p.ownedTiles = p.ownedTiles.filter((i) => i !== ownIdx);
    });
    tile.owner = player.id;
    if (!player.ownedTiles.includes(ownIdx)) player.ownedTiles.push(ownIdx);
    refresh();
  };

  const handleSetGold = () => {
    player.gold = Math.max(0, Math.min(GOLD_CAP, Math.round(gold)));
    refresh();
  };

  const handleSetUnits = () => {
    player.militia = Math.max(0, Math.min(unitCap, Math.round(militia)));
    player.riders = Math.max(0, Math.min(unitCap, Math.round(riders)));
    refresh();
  };

  const handleSetFame = () => {
    player.fame = Math.max(0, Math.min(FAME_CAP, Math.round(fame)));
    refresh();
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">👻 {t('cheatScreen.title')}</h2>

        <div className="cheat-row">
          <label>{t('cheatScreen.moveTo')}</label>
          <select value={moveIdx} onChange={(e) => setMoveIdx(Number(e.target.value))}>
            {tileOptions.map((opt) => (
              <option key={opt.index} value={opt.index}>
                {opt.name}
              </option>
            ))}
          </select>
          <button className="game-menu-button" onClick={handleMove}>
            {t('cheatScreen.move')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('cheatScreen.ownTile')}</label>
          <select value={ownIdx} onChange={(e) => setOwnIdx(Number(e.target.value))}>
            {tileOptions.map((opt) => (
              <option key={opt.index} value={opt.index}>
                {opt.name}
              </option>
            ))}
          </select>
          <button className="game-menu-button" onClick={handleOwn}>
            {t('cheatScreen.own')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('cheatScreen.setMoney')}</label>
          <input
            type="number"
            min={0}
            max={GOLD_CAP}
            value={gold}
            style={{ width: '5.5rem' }}
            onChange={(e) => setGold(Math.max(0, Math.min(GOLD_CAP, parseInt(e.target.value, 10) || 0)))}
          />
          <button className="game-menu-button" onClick={handleSetGold}>
            {t('cheatScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('cheatScreen.setUnits')}</label>
          <input
            type="number"
            min={0}
            max={unitCap}
            value={militia}
            style={{ width: '4rem' }}
            onChange={(e) => setMilitia(Math.max(0, Math.min(unitCap, parseInt(e.target.value, 10) || 0)))}
          />
          🧍
          <input
            type="number"
            min={0}
            max={unitCap}
            value={riders}
            style={{ width: '4rem' }}
            onChange={(e) => setRiders(Math.max(0, Math.min(unitCap, parseInt(e.target.value, 10) || 0)))}
          />
          🐎
          <button className="game-menu-button" onClick={handleSetUnits}>
            {t('cheatScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('cheatScreen.setFame')}</label>
          <input
            type="number"
            min={0}
            max={FAME_CAP}
            value={fame}
            style={{ width: '4rem' }}
            onChange={(e) => setFame(Math.max(0, Math.min(FAME_CAP, parseInt(e.target.value, 10) || 0)))}
          />
          🏆
          <button className="game-menu-button" onClick={handleSetFame}>
            {t('cheatScreen.set')}
          </button>
        </div>

        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <DecoratedButton onClick={clearScreen}>{t('common.close')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default CheatScreen;
