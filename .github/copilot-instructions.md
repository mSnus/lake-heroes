# Copilot instructions for lakeheroes/board-game-simulator

Purpose

- Immediate, actionable knowledge for making code changes that work with this repo's runtime data and UI.
- Only document facts discoverable in the tree.

Quick facts (where to look)

- Tile definitions: src/settings/tiles.json (schema, special tiles, numeric keys as strings).
- Map coordinates: src/settings/map.json and src/settings/map_mobile.json — percent coords are expressed relative to board width (see src/components/board/common.ts).
- Groups metadata: src/settings/groups.json (icons, colors).
- Layout algorithm: src/components/board/layout.ts — SLOT_COUNT = 24 and fixed placements:
  - #1 King Castle, #8 Treasure box, #13 Prison, #17 Treasure box, #20 Freelancers' camp (0-based indices used in code: 0,7,12,16,19).
  - No adjacent tiles of same group when alternatives exist.
- TILE_COUNT constant and layout math: src/components/board/common.ts sets TILE_COUNT = 24 and is used across rendering and indexing.
- Dice contract: src/game/Dice.ts dispatches a global `diceRolled` CustomEvent with detail = number; DiceWidget listens for it (src/components/DiceWidget.tsx).
- Persistence: board saved under key 'board-state' via utils/storage; restore uses Object.assign(new Board([], []), saved) in src/App.tsx.

Tiles JSON schema (concrete)

- Typical properties: group, name (may include emoji), isOwnable, bonusType ("gold"|"units"), priceGold, priceUnits, upgradePrices (keys "2","3" -> {gold,units}), bonuses (keys "1","2","3" -> number), defences (keys "1","2","3" -> number).
- Special tiles: isOwnable: false, priceGold/priceUnits: 0, upgradePrices/bonuses/defences: {}.
- Keep numeric keys as strings to match current consumers (e.g., "2", "3").

Useful examples & gotchas

- Add a Mill tile following src/settings/tiles.json patterns (emoji allowed). Example snippet:
  { "group":"Mills","name":"💧 Water mill","isOwnable":true,"bonusType":"gold","priceGold":200,"priceUnits":5, "upgradePrices":{"2":{"gold":300,"units":5},"3":{"gold":500,"units":10}}, "bonuses":{"1":100,"2":200,"3":300}, "defences":{"1":10,"2":15,"3":30} }
- Map percent coords are used directly as percentages in BoardCanvas (getTilePosition returns x/y as percent values). When editing map.json/map_mobile.json preserve numeric xPct/yPct.
- Layout.ts relies on duplicated "Treasure box" tile being removed twice from the pool — if you rename or dedupe that tile, layout code will throw or misplace tiles.
- Dice UI: to trigger visual roll, either call new Dice().roll() or dispatch a `diceRolled` CustomEvent with numeric detail.

Where to be careful

- Search for usages before changing schema: tiles.json is consumed during board initialization (App.tsx → buildTileLayoutFromTemplates → Tile constructor).
- parseTileName in src/components/board/common.ts extracts emoji prefix and two text parts; changing tile.name format may break title rendering.
- BoardCanvas has some inline style expressions that rely on truthy checks — be mindful of operator precedence in ternaries when adjusting border logic.
- When adding new bonusType values (beyond "gold"|"units") update any switch/case or UI logic that reads bonusType across the codebase.

Quick workflow

1. Inspect relevant files mentioned above.
2. Make small, isolated JSON edits (tiles or maps).
3. Start app / run tests — check package.json for available scripts at project root.
4. If changing schema or new bonus type, run a repo-wide search and update consumers (parsers, UI, game logic).

If something here is unclear or you want examples expanded (e.g., exact consumers of bonusType, Tile/Player constructors, or package.json scripts) tell me which area to expand.
