/*
  Import tiles from CSV back to tiles.json.
  Input:  exports/tiles.csv
  Output: src/settings/tiles.json

  Numeric columns are parsed as numbers.
  Fields not present in CSV (icon, sprite, description) are preserved
  from the existing tiles.json, matched by tile name (fallback: by index).
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const tilesPath = path.join(ROOT, 'src', 'settings', 'tiles.json');
const csvPath = path.join(ROOT, 'exports', 'tiles.csv');

/** Parse a single CSV line, respecting double-quoted fields. */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function num(val) { return Number(val) || 0; }
function bool(val) { return val === 'true'; }

function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}\nRun "npm run export:tiles" first.`);
  }

  const existing = JSON.parse(fs.readFileSync(tilesPath, 'utf8'));
  // Build lookup by name for preserved fields (icon, sprite, description)
  const preservedByName = {};
  existing.forEach((t, i) => {
    preservedByName[t.name] = { icon: t.icon, sprite: t.sprite, description: t.description, _index: i };
  });

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const lines = csvText.split('\n').filter(l => l.trim() !== '');
  const headers = parseCsvLine(lines[0]);

  const col = (row, name) => row[headers.indexOf(name)] ?? '';

  const tiles = lines.slice(1).map((line, i) => {
    const row = parseCsvLine(line);
    const name = col(row, 'name');
    const isOwnable = bool(col(row, 'isOwnable'));

    // Preserved fields: look up by name first, fall back to original index
    const pres = preservedByName[name] ?? existing[i] ?? {};

    const tile = {
      group: col(row, 'group'),
      icon: pres.icon ?? '',
      name,
      isOwnable,
    };

    if (isOwnable) {
      tile.bonusType = col(row, 'bonusType') || 'gold';
      tile.requiredCharisma = num(col(row, 'requiredCharisma'));
      tile.prices = {
        '1': { gold: num(col(row, 'gold_1')), units: num(col(row, 'units_1')) },
        '2': { gold: num(col(row, 'gold_2')), units: num(col(row, 'units_2')) },
        '3': { gold: num(col(row, 'gold_3')), units: num(col(row, 'units_3')) },
      };
      tile.bonuses = {
        '1': num(col(row, 'bonus1')),
        '2': num(col(row, 'bonus2')),
        '3': num(col(row, 'bonus3')),
      };
      tile.defences = {
        '1': num(col(row, 'defence1')),
        '2': num(col(row, 'defence2')),
        '3': num(col(row, 'defence3')),
      };
    } else {
      tile.prices = { '1': { gold: 0, units: 0 } };
      tile.bonuses = {};
      tile.defences = {};
      if (pres.description != null) tile.description = pres.description;
    }

    if (pres.sprite != null) tile.sprite = pres.sprite;

    return tile;
  });

  fs.writeFileSync(tilesPath, JSON.stringify(tiles, null, 2) + '\n', 'utf8');
  console.log(`Imported ${tiles.length} tiles from ${path.relative(ROOT, csvPath)} → src/settings/tiles.json`);
}

main();
