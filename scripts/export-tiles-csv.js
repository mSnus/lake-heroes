/*
  Export tiles.json to a flattened CSV.
  Output: exports/tiles.csv

  Columns:
  index,group,name,isOwnable,bonusType,priceGold,priceUnits,
  upgrade2_gold,upgrade2_units,upgrade3_gold,upgrade3_units,
  bonus1,bonus2,bonus3,defence1,defence2,defence3
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tilesPath = path.join(ROOT, 'src', 'settings', 'tiles.json');
const outDir = path.join(ROOT, 'exports');
const outPath = path.join(outDir, 'tiles.csv');

/** Quote a value for CSV (comma delimiter). */
function q(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // Always quote text-like values; keep numbers unquoted
  const isNumeric = /^-?\d+(?:\.\d+)?$/.test(s);
  if (isNumeric) return s;
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function main() {
  const tiles = JSON.parse(fs.readFileSync(tilesPath, 'utf8'));
  if (!Array.isArray(tiles)) {
    throw new Error('tiles.json does not contain an array');
  }

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const headers = [
    'index',
    'group',
    'name',
    'isOwnable',
    'bonusType',
    'priceGold',
    'priceUnits',
    'upgrade2_gold',
    'upgrade2_units',
    'upgrade3_gold',
    'upgrade3_units',
    'bonus1',
    'bonus2',
    'bonus3',
    'defence1',
    'defence2',
    'defence3',
  ];

  const lines = [];
  lines.push(headers.join(','));

  tiles.forEach((t, i) => {
    const upgrades = t.upgradePrices || {};
    const up2 = upgrades['2'] || { gold: 0, units: 0 };
    const up3 = upgrades['3'] || { gold: 0, units: 0 };
    const bonuses = t.bonuses || {};
    const defences = t.defences || {};

    const row = [
      i + 1,
      t.group ?? '',
      t.name ?? '',
      !!t.isOwnable,
      t.bonusType ?? '',
      t.priceGold ?? 0,
      t.priceUnits ?? 0,
      up2.gold ?? 0,
      up2.units ?? 0,
      up3.gold ?? 0,
      up3.units ?? 0,
      bonuses['1'] ?? 0,
      bonuses['2'] ?? 0,
      bonuses['3'] ?? 0,
      defences['1'] ?? 0,
      defences['2'] ?? 0,
      defences['3'] ?? 0,
    ]
      .map(q)
      .join(',');
    lines.push(row);
  });

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Exported ${tiles.length} tiles to ${path.relative(ROOT, outPath)}`);
}

main();
