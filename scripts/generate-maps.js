// Generates src/settings/map.json and map_mobile.json with xPct/yPct measured relative to board width
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'src', 'settings');

const TILE_WIDTH = 120;
const TILE_HEIGHT = 100;

function perimeterSlots(cols, rows, tileW, tileH) {
  const slots = [];

  // top row: col 0..cols-1, row=0
  for (let c = 0; c < cols; c++) slots.push({ col: c, row: 0 });

  // right column: row 1..rows-1, col = cols-1
  for (let r = 1; r < rows; r++) slots.push({ col: cols - 1, row: r });

  // bottom row: col cols-2 .. 0, row = rows-1
  for (let c = cols - 2; c >= 0; c--) slots.push({ col: c, row: rows - 1 });

  // left column: row rows-2 .. 1, col = 0
  for (let r = rows - 2; r >= 1; r--) slots.push({ col: 0, row: r });

  if (slots.length !== 24) {
    console.warn(`Generated ${slots.length} slots (expected 24) for ${cols}x${rows}`);
  }

  // convert to percentages relative to board width:
  // boardWidthPx = cols * tileW
  const boardWidthPx = cols * tileW;

  return slots.map(({ col, row }) => {
    const xPx = col * tileW;
    const yPx = row * tileH;
    const xPct = (xPx / boardWidthPx) * 100;
    const yPct = (yPx / boardWidthPx) * 100; // intentionally relative to board width per spec
    return { xPct: Number(xPct.toFixed(4)), yPct: Number(yPct.toFixed(4)) };
  });
}

function writeJson(filename, data) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Wrote', outPath);
}

// Desktop: 8x6, ratioX=1, ratioY=1
const desktop = perimeterSlots(8, 6, TILE_WIDTH, TILE_HEIGHT);
writeJson('map.json', desktop);

// Mobile: 6x8, mobile tile size uses layout ratios from code (ratioX=1.8, ratioY=1.2)
const mobileTileW = TILE_WIDTH / 1.8;
const mobileTileH = TILE_HEIGHT / 1.2;
const mobile = perimeterSlots(6, 8, mobileTileW, mobileTileH);
writeJson('map_mobile.json', mobile);

console.log('Done.');
