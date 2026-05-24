import React from 'react';
import { clearScreen } from '../utils/screenStore';
import pkg from '../../package.json';

const RULES_HTML = `
<h3>Objective</h3>
<p>Be the first to amass <strong>50+ warriors</strong> and slay the Dragon to claim victory.</p>

<h3>Turn order</h3>
<ol>
  <li>Roll the dice and move your hero around the board.</li>
  <li>Take action based on the tile you land on.</li>
  <li>End your turn — bonuses and income are paid when you pass the King's Castle.</li>
</ol>

<h3>Tiles</h3>
<ul>
  <li><strong>Unowned tile</strong> — buy it by spending gold &amp; warriors. Tiles have 3 levels; upgrade by visiting your own tile.</li>
  <li><strong>Opponent's tile</strong> — pay a fee, sell tiles to cover it, or fight for ownership. Losing a battle costs warriors only; losing without resources sends you to prison.</li>
  <li><strong>Own tile</strong> — collect its bonus (gold or warriors) each visit after your first lap.</li>
</ul>

<h3>Special tiles</h3>
<ul>
  <li>🏰 <strong>King's Castle</strong> — buy warriors. Passing it grants base income plus bonuses from all your properties.</li>
  <li>📦 <strong>Treasure Box</strong> — roll for a gold reward.</li>
  <li>🍺 <strong>Tavern</strong> — roll: gain or lose gold and warriors.</li>
  <li>🦁 <strong>Sphynx</strong> — roll: pay tribute or receive a reward.</li>
  <li>⛓️ <strong>Prison</strong> — skip 2 turns.</li>
  <li>🃏 <strong>Joker</strong> — random event: Taxes, Plague, Hurricane, Blessing, King's Gift, or Earthquake.</li>
</ul>

<h3>Dragon</h3>
<ul>
  <li>At the <em>start</em> of your turn with 50+ warriors — choose to challenge the Dragon or roll dice instead.</li>
  <li><em>After</em> moving — a dragon may appear in the sky (rare). With enough leadership and after 3 laps it may attack: a weak army loses its most expensive property; a strong one (50+ warriors) must fight.</li>
</ul>

<h3>Battle</h3>
<p>Combat is resolved in rounds. Each round both sides roll; higher roll wins the round. Most rounds won takes the tile. A draw razes it. Losers pay only in warriors — no gold penalty.</p>

<h3>Leadership (charisma)</h3>
<p>Grows as you acquire special properties. Higher leadership increases passive warrior income each lap and unlocks access to elite tiles. The Dragon targets high-leadership heroes.</p>
`;

const HelpScreen: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 7000,
      background: 'rgba(10,6,2,0.96)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      padding: '24px 16px 40px',
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: '640px',
        color: '#e8d8b0',
        fontFamily: 'serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ margin: 0, color: '#ffe066', fontSize: '1.4rem' }}>
          Dragon's Bounty&nbsp;
          <span style={{ fontWeight: 'normal', fontSize: '1rem', opacity: 0.7 }}>
            v.{pkg.version}
          </span>
        </h2>
        <button
          onClick={clearScreen}
          style={{
            background: 'none',
            border: '1px solid #666',
            color: '#ccc',
            cursor: 'pointer',
            fontSize: '1.1rem',
            padding: '2px 10px',
            borderRadius: '4px',
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{ lineHeight: 1.6, fontSize: '0.95rem' }}
        dangerouslySetInnerHTML={{ __html: RULES_HTML }}
      />
    </div>
  </div>
);

export default HelpScreen;
