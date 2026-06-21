import React, { useEffect, useState } from 'react';
import { clearScreen } from '../utils/screenStore';
import pkg from '../../package.json';
import tilesData from '../settings/tiles.json';
import { Tile, TileJSON } from '../game/Tile';
import { TileCard } from './TileCard';
import { DecoratedButton } from './DecoratedButton';
import '../styles/HelpScreen.css';
import { KNIGHT_FAME } from '../utils/fame';

const waterMillData = (tilesData as TileJSON[]).find((t) => t.name === 'Water mill');
const waterMillTile = waterMillData ? new Tile(waterMillData) : null;

const HelpScreen: React.FC = () => {
  const [version, setVersion] = useState(pkg.version);

  useEffect(() => {
    fetch('/version.txt')
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (text?.trim()) setVersion(text.trim());
      })
      .catch(() => {});
  }, []);

  return (
    <div className="help-screen">
      <div className="help-screen-inner">
        <div className="help-screen-header">
          <h2 className="help-screen-title">
            Dragon's Bounty&nbsp;
            <span className="help-screen-version">v.{version}</span>
          </h2>
          <button onClick={clearScreen} className="help-screen-close">
            ✕
          </button>
        </div>

        <div className="help-screen-body">
          <h3>Objective</h3>
          <p>
            Be the first to amass <strong>50+ warriors 🧍</strong> and slay the Dragon 🐉 to claim
            victory!
          </p>

          <h3>Turn order</h3>
          <ol>
            <li>Roll the dice 🎲 (or shake your phone 📳) and move your hero around the board</li>
            <li>Take action based on the tile you land on</li>
            <li>Upgrade or sell your tiles if needed</li>
            <li>End your turn ⏳ </li>
            <li>Each circle makes a year — pass the 🏰 King's Castle to receive the rewards</li>
          </ol>

          <h3>Gold 🟡 and units 🧍</h3>
          <ul>
            <li>
              Gold 🟡 and units 🧍 are the basic resources used to buy tiles, fight or start a final
              battle
            </li>
            <li>Yearly income: more tiles you own, more you get each year</li>
          </ul>

          <h3>Fame 🏆</h3>
          <ul>
            <li>It's your reputation. It depends on each battle won or lost and tiles owned. </li>
            <li>
              Fame more than ${KNIGHT_FAME} promotes you to a rider, but makes more visible for a
              dragon - beware, it could attack!
            </li>
            <li>
              More fame allows to recruit more units at the King's Castle, increases your stable
              units 🧍 income and allows to own the best tiles
            </li>
          </ul>

          <h3>Tiles 🧩</h3>
          <ul>
            <li>
              <strong>Discover</strong> new tiles and get rewarded for that
              <div className="tile-sprite-container">
                <div className="tile-sprite tile-sprite-unowned"></div>
              </div>
            </li>

            <li>
              <strong>👛 Own tiles</strong> by spending gold 🟡 and 🧍 units. Visiting own tiles
              brings you bonus from it
            </li>

            <li>
              <strong>⬆️ Upgrade tiles</strong> by spending gold 🟡 and 🧍 units to increase tile's
              income and defence. Click the bottom of the card to upgrade
            </li>

            <li>
              <strong>Landing on opponent's tile</strong> — pay a fee 💰 or battle ⚔️ to overtake
              it. If you don't have enough gold or units, sell some of your tiles. Battle costs
              units to the attacker. If you can't neither battle, nor pay, you become a prisoner of
              war: spend 2 turns in a prison, after that receive some starting bonus to continue
              playing.
            </li>

            <li>
              <strong>Syndicates</strong> — own every tile of some group and you form a syndicate:
              income bonus and fee is <strong>doubled</strong>
            </li>

            <li>
              <strong>Click on the tile's title or data</strong> to view it's bonuses and defences
              on each level
            </li>
          </ul>

          {waterMillTile && (
            <div className="help-screen-card">
              <TileCard tile={waterMillTile} mode="display" defaultExpanded demoMode={true} />
            </div>
          )}

          <h3>Special tiles 🃏</h3>
          <ul>
            <li>
              🏰 <strong>King's Castle</strong> — visit to recruit 🧍 units for gold, the amount is
              limited by your fame. Passing the King's Castle grants base income plus bonuses from
              all your properties.
            </li>
            <li>
              📦 <strong>Treasure Chest</strong> — gold reward, sized small/medium/large.
            </li>
            <li>
              🍺 <strong>Tavern</strong> — recruit units
            </li>
            <li>
              🦁 <strong>Sphynx</strong>: <br />
              Roll dice 🎲:
              <br /> <b>1,2</b> - lose half of your 🟡
              <br />
              <b>3,4</b> - lose 1/3 🧍
              <br /> <b>5</b> - nothing, exhale 🌬️
              <br /> <b>6</b> - gain half of your 🟡
            </li>
            <li>
              ⛓️ <strong>Prison</strong> — skip a turn. While you're in prison, noone pays for
              visiting your tiles
            </li>
            <li>
              🃏 <strong>Joker</strong> — random global event: Taxes, Plague, Hurricane, Blessing,
              King's Grace, or Earthquake.
            </li>
          </ul>

          <h3>Caravan 🐪</h3>
          <ul>
            <li>
              At the <em>start</em> of your turn you have a chance to encounter a caravan brining
              treasures or slaves
            </li>
            <li>
              Defeat the caravan guards to free the slaves (they join your army) or pillage the
              treasures!
            </li>
          </ul>

          <h3>Battle ⚔️</h3>
          <ul>
            <li>
              The attacker sends a{' '}
              <strong>squad of units in amount equal to 🛡️ Defence value</strong>, risking their
              lifes for some goal: caravan goods or slaves, razing the tile or fighting the Dragon.
            </li>
            <li>
              <strong>Razing</strong> means the tile looses all it's upgrades and belongs to no one
            </li>
            <li>The are two modes: brawl and normal battle</li>
            <li>
              In <strong>Brawl mode:</strong> Simple mode, used when squad is less than 6 units.
              Attacker and defender roll dice, who rolls more, wins the round.
            </li>
            <li>
              <strong>Normal battle:</strong> Combat is resolved in rounds. Each round both sides
              roll the dice; the amount rolled is the number of enemy units destroyed. The one to
              destroy all enemy units first wins.
            </li>
            <li>If all attacker and defender units are killed, that's a Tie</li>
            <li>
              The victory comes with a price! As a result of a battle, winner loses units killed in
              battle.
            </li>
          </ul>

          <h3>Dragon 🐉</h3>
          <ul>
            <li>
              If you have more than 50 warriors at the <em>start</em> of your turn — choose to challenge the Dragon
              or roll dice instead.
            </li>
            <li>
              Sometimes while travelling you may see the dragon in the sky. And if you're rich and famous, beware: he could
               attack you and burn your tiles to the ground!
            </li>
          </ul>

          <div className="help-screen-continue">
            <DecoratedButton onClick={clearScreen}>Continue</DecoratedButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpScreen;
