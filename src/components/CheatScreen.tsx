import React, { useState } from 'react';
import { GameState, ForcedEncounter } from '../game/GameState';
import { clearScreen } from '../utils/screenStore';
import { gameEvent } from '../utils/events';
import { grantTile } from '../game/tileOwnership';
import { say, sayLocal } from '../utils/say';
import { DecoratedButton } from './DecoratedButton';
import { getOverrides } from '../utils/overridesStore';
import { setForcedRoll } from '../utils/diceStore';
import { useT } from '../i18n';
import GameModal from './GameModal';
import '../styles/modal.css';
import '../styles/CheatScreen.css';

// Generous safety ceilings for values with no real in-game maximum, so the
// number inputs still have a sane bound.
const GOLD_CAP = 99999;
const FAME_CAP = 99;

/** Clamp a number input's value to [0, max], and write the clamped text
 * back into the input itself -- if the parsed value doesn't change (e.g. a
 * leading zero typed in front of an existing digit), React bails out of
 * re-rendering since the state is unchanged, leaving the stray zero in the
 * DOM otherwise. */
function clampedInput(e: React.ChangeEvent<HTMLInputElement>, max: number, setter: (n: number) => void) {
  const n = Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0));
  e.target.value = String(n);
  setter(n);
}

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
  const unitCap = getOverrides().armySlotCapacity * player.armySlots;

  const [moveIdx, setMoveIdx] = useState(tileOptions[0]?.index ?? 0);
  const [ownIdx, setOwnIdx] = useState(tileOptions[0]?.index ?? 0);
  const [gold, setGold] = useState(player.gold);
  const [militia, setMilitia] = useState(player.militia);
  const [riders, setRiders] = useState(player.riders);
  const [fame, setFame] = useState(player.fame);
  const [forcedEnc, setForcedEnc] = useState<ForcedEncounter>('caravan-gold');
  const [forcedRollValue, setForcedRollValue] = useState(1);

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
    grantTile(gameState, tile, player);
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

  const handleForceEncounter = () => {
    gameState.forcedEncounter = forcedEnc;
    refresh();
    sayLocal(t('cheatScreen.forcedEncounterSet'), 'info');
  };

  const handleForceRoll = () => {
    setForcedRoll(forcedRollValue);
    sayLocal(t('cheatScreen.forcedRollSet', { value: forcedRollValue }), 'info');
  };

  return (
    <GameModal className="game-modal" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <div className="modal-content cheat-screen">
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
            onChange={(e) => clampedInput(e, GOLD_CAP, setGold)}
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
            onChange={(e) => clampedInput(e, unitCap, setMilitia)}
          />
          🧍
          <input
            type="number"
            min={0}
            max={unitCap}
            value={riders}
            style={{ width: '4rem' }}
            onChange={(e) => clampedInput(e, unitCap, setRiders)}
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
            onChange={(e) => clampedInput(e, FAME_CAP, setFame)}
          />
          🏆
          <button className="game-menu-button" onClick={handleSetFame}>
            {t('cheatScreen.set')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('cheatScreen.forceEncounter')}</label>
          <select value={forcedEnc} onChange={(e) => setForcedEnc(e.target.value as ForcedEncounter)}>
            <option value="caravan-gold">{t('cheatScreen.encCaravanGold')}</option>
            <option value="caravan-slaves">{t('cheatScreen.encCaravanSlaves')}</option>
            <option value="caravan-horses">{t('cheatScreen.encCaravanHorses')}</option>
            <option value="rogue">{t('cheatScreen.encRogue')}</option>
            <option value="dragon">{t('cheatScreen.encDragon')}</option>
            <option value="workers">{t('cheatScreen.encWorkers')}</option>
          </select>
          <button className="game-menu-button" onClick={handleForceEncounter}>
            {t('cheatScreen.force')}
          </button>
        </div>

        <div className="cheat-row">
          <label>{t('cheatScreen.forceRoll')}</label>
          <select value={forcedRollValue} onChange={(e) => setForcedRollValue(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button className="game-menu-button" onClick={handleForceRoll}>
            {t('cheatScreen.force')}
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
