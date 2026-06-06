import React, { useState } from 'react';
import { playerOptions, generatePlayerName } from '../game/PlayerOptions';
import { MAX_PLAYERS, MONEY_START, UNITS_START } from './board/common';
import GameModal from './GameModal';
import '../styles/modal.css';
import { PlayerSetup } from '../utils/playerSetup';

interface NewGameModalProps {
  onStart: (players: PlayerSetup[]) => void;
}

const NewGameModal: React.FC<NewGameModalProps> = ({ onStart }) => {
  const [numPlayers, setNumPlayers] = useState(2);
  const [players, setPlayers] = useState<PlayerSetup[]>(() => {
    const initialPlayers: PlayerSetup[] = [];
    for (let i = 0; i < numPlayers; i++) {
      initialPlayers.push({
        name: generatePlayerName(initialPlayers.map((p) => p.name)),
        color: playerOptions[i].color,
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
    if (field === 'color') {
      const selectedOption = playerOptions.find((opt) => opt.color === value);
      if (selectedOption) {
        newPlayers[index].color = selectedOption.color;
        newPlayers[index].image = selectedOption.image;
      }
    } else {
      (newPlayers[index] as any)[field] = value;
    }

    setPlayers(newPlayers);
  };

  const getSelectedOption = (player: PlayerSetup) => {
    return playerOptions.find((opt) => opt.color === player.color);
  };

  return (
    <GameModal className="modal-new-game" backgroundImage="assets/screens/dragon.jpg" noBorder>
      <>
        <div className="game-title">Dragon's Bounty</div>
        <div className="input-group">
          <label>Heroes: </label>
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
              }}
              title="Random name"
            >
              ↪️
            </button>
            <input
              type="text"
              value={player.name}
              onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
            />
            <select
              value={player.color}
              onChange={(e) => handlePlayerChange(index, 'color', e.target.value)}
            >
              {playerOptions.map((opt) => (
                <option
                  key={opt.color}
                  value={opt.color}
                  disabled={players.some((p, i) => i !== index && p.color === opt.color)}
                >
                  {opt.colorName}
                </option>
              ))}
            </select>
            {getSelectedOption(player) && (
              <img
                src={`assets/figures/rider-${getSelectedOption(player)?.image}.png`}
                alt={getSelectedOption(player)?.colorName}
                style={{ width: '60px', height: '60px' }}
                className="player-image current-player"
              />
            )}
          </div>
        ))}
        <div className="button-group">
          <button
            onClick={() => onStart(players)}
            className="decorated"
            style={{ backgroundImage: `url(assets/button.png)` }}
          >
            Start Game
          </button>
        </div>
      </>
    </GameModal>
  );
};

export default NewGameModal;
