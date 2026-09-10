import React, { useState } from 'react';
import { playerOptions, generatePlayerName } from '../game/PlayerOptions';
import { MAX_PLAYERS, MONEY_START, UNITS_START } from './board/common';
import GameModal from './GameModal';
import '../styles/modal.css';
import { PlayerSetup } from '../utils/playerSetup';
import { DecoratedButton } from './DecoratedButton';
import { CharacterId } from '../ai/characters';
import { useAppVersion } from '../utils/useAppVersion';
import { useT } from '../i18n';

// Cycle order for the per-player mode toggle: human -> explorer -> warrior -> wizard -> human...
const MODE_CYCLE: (CharacterId | null)[] = [null, 'explorer', 'warrior', 'wizard'];
const MODE_EMOJI: Record<CharacterId | 'human', string> = {
  human: '🧒',
  explorer: '🧑‍🌾',
  warrior: '💂',
  wizard: '🧙',
};

// Swapped into the last word of the name when a character is picked.
const CHARACTER_NAME_SUFFIX_KEY: Record<CharacterId, string> = {
  explorer: 'newGameModal.characterSuffixFarmer',
  warrior: 'newGameModal.characterSuffixWarrior',
  wizard: 'newGameModal.characterSuffixWizard',
};

interface NewGameModalProps {
  /** `online` publishes the game and mints a join code per seat. */
  onStart: (players: PlayerSetup[], online?: boolean) => void;
}

const NewGameModal: React.FC<NewGameModalProps> = ({ onStart }) => {
  const t = useT();
  const version = useAppVersion();
  const [numPlayers, setNumPlayers] = useState(2);
  const [openColorIndex, setOpenColorIndex] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerSetup[]>(() => {
    const initialPlayers: PlayerSetup[] = [];
    for (let i = 0; i < numPlayers; i++) {
      initialPlayers.push({
        name: generatePlayerName(initialPlayers.map((p) => p.name)),
        color: playerOptions[i].color,
        lightColor: playerOptions[i].lightColor,
        image: playerOptions[i].image,
        gold: MONEY_START,
        units: UNITS_START,
        position: 0,
      });
    }

    return initialPlayers;
  });

  const handleNumPlayersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const count = parseInt(e.target.value);
    setNumPlayers(count);
    const newPlayers: PlayerSetup[] = [];

    for (let i = 0; i < count; i++) {
      if (players[i]) {
        newPlayers.push(players[i]);
        continue;
      }

      // Find the first available color
      const usedColors: string[] = newPlayers ? newPlayers.map((p: PlayerSetup) => p.color) : [];
      const availableOption = playerOptions.find((opt) => !usedColors.includes(opt.color));

      newPlayers.push({
        name: generatePlayerName(newPlayers.map((p) => p.name)),
        color: availableOption?.color || '#FFFFFF',
        lightColor: availableOption?.lightColor || '#FFFFFF',
        image: availableOption?.image || '',
        gold: MONEY_START,
        units: UNITS_START,
        position: 0,
      });
    }

    setPlayers(newPlayers);
  };

  const handlePlayerChange = (index: number, field: keyof PlayerSetup, value: string) => {
    const newPlayers = [...players];
    (newPlayers[index] as any)[field] = value;
    setPlayers(newPlayers);
  };

  // Picking a color already worn by another player bumps that player to the
  // first color nobody else is using, rather than blocking the pick.
  const handleColorChange = (index: number, newColor: string) => {
    const selectedOption = playerOptions.find((opt) => opt.color === newColor);
    if (!selectedOption) return;

    const newPlayers = [...players];
    newPlayers[index] = {
      ...newPlayers[index],
      color: selectedOption.color,
      lightColor: selectedOption.lightColor,
      image: selectedOption.image,
    };

    const conflictIdx = newPlayers.findIndex((p, i) => i !== index && p.color === newColor);
    if (conflictIdx !== -1) {
      const usedColors = newPlayers
        .filter((_, i) => i !== conflictIdx)
        .map((p) => p.color);
      const nextAvailable = playerOptions.find((opt) => !usedColors.includes(opt.color));
      if (nextAvailable) {
        newPlayers[conflictIdx] = {
          ...newPlayers[conflictIdx],
          color: nextAvailable.color,
          lightColor: nextAvailable.lightColor,
          image: nextAvailable.image,
        };
      }
    }

    setPlayers(newPlayers);
    setOpenColorIndex(null);
  };

  const getSelectedOption = (player: PlayerSetup) => {
    return playerOptions.find((opt) => opt.color === player.color);
  };

  const handleCycleMode = (index: number) => {
    const newPlayers = [...players];
    const player = { ...newPlayers[index] };
    const currentKey: CharacterId | 'human' = player.isComputer
      ? player.character ?? 'explorer'
      : 'human';
    const currentIdx = MODE_CYCLE.findIndex((c) => (c ?? 'human') === currentKey);
    const next = MODE_CYCLE[(currentIdx + 1) % MODE_CYCLE.length];

    player.isComputer = next !== null;
    player.character = next ?? undefined;

    const nameParts = player.name.split(' ');
    const pronoun = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
    player.name = next
      ? `${pronoun} ${t(CHARACTER_NAME_SUFFIX_KEY[next])}`
      : generatePlayerName(players.filter((_, i) => i !== index).map((p) => p.name));

    newPlayers[index] = player;
    setPlayers(newPlayers);
  };

  return (
    <GameModal className="modal-new-game" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <>
        <div className="game-title">Dragon's Bounty</div>
        <div style={{ textAlign: 'center', fontSize: '1rem', color: 'gold', marginTop: '-8px' }}>
          v.{version}
        </div>
        <div className="input-group">
          <label>{t('newGameModal.heroes')} </label>
          <select value={numPlayers} onChange={handleNumPlayersChange}>
            {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {players.map((player, index) => (
          <div
            key={index}
            className="input-group"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            
            <input
              type="text"
              value={player.name}
              onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
              style={{paddingRight: '1.75rem'}}
            />
            <button
              onClick={() =>
                handlePlayerChange(
                  index,
                  'name',
                  generatePlayerName(players.filter((_, i) => i !== index).map((p) => p.name))
                )
              }
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0 4px',
                marginLeft: '-2.5rem'
              }}
              title={t('newGameModal.randomName')}
            >
              ↪️
            </button>
            <button
              onClick={() => handleCycleMode(index)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0 4px',
                whiteSpace: 'nowrap',
              }}
              title={t('newGameModal.humanComputerToggle')}
            >
              {MODE_EMOJI[player.isComputer ? player.character ?? 'explorer' : 'human']}
            </button>
            <div className="color-picker-wrapper">
              {getSelectedOption(player) && (
                <img
                  src={`assets/figures/rider-${getSelectedOption(player)?.image}.png`}
                  alt={getSelectedOption(player) ? t(`playerOptions.${getSelectedOption(player)?.image}`) : undefined}
                  onClick={() => setOpenColorIndex(openColorIndex === index ? null : index)}
                  style={{ width: '60px', height: '60px', cursor: 'pointer' }}
                  className="player-image"
                />
              )}
              {openColorIndex === index && (
                <div className="color-swatch-list">
                  {playerOptions.map((opt) => (
                    <button
                      key={opt.color}
                      type="button"
                      className={`color-swatch${opt.color === player.color ? ' selected' : ''}`}
                      style={{ backgroundColor: opt.color }}
                      title={t(`playerOptions.${opt.image}`)}
                      onClick={() => handleColorChange(index, opt.color)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="button-group">
          <DecoratedButton onClick={() => onStart(players)}>{t('newGameModal.startGame')}</DecoratedButton>
          <DecoratedButton onClick={() => onStart(players, true)}>{t('online.hostGame')}</DecoratedButton>
        </div>
      </>
    </GameModal>
  );
};

export default NewGameModal;
