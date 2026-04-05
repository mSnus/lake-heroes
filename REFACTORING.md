#found Code Quality & Refactoring Notes

Analysis of the current codebase with suggestions grouped by impact.

---

## High Impact

**`BattleScreen.tsx` — 11 `useState` hooks, should be `useReducer`**
The battle phases form a state machine. All that interconnected state (`phase`, `revealCount`, `attackerRoll`, `defenderRoll`, etc.) plus the `useRef` workarounds to avoid stale closures are a sign that `useReducer` is the right tool. A single `dispatch({ type: 'ATTACKER_ROLLED', roll })` would be far more readable and eliminate the ref hacks.

**`rollAndMove.ts` — fragile tile detection via `tile.name.includes()`**
Five separate `tile.name.includes('Treasure')`, `includes('Tavern')` etc. checks. Renaming a tile breaks the logic silently. The tile type should be a discriminated field (`tile.type: 'treasure' | 'tavern' | 'prison' | ...`) set in `tiles.json`, checked with a switch.

**`Tile.ts` — direct `_level` mutation from outside**
`tile._level = 1` is scattered across `becomeBeggar.ts`, `BattleScreen.tsx`, `sellTile.ts`. The underscore prefix signals "private" but TypeScript doesn't enforce it. A `tile.resetLevel()` method would encapsulate this and make intent clear.

**`afterMoveLogic.ts` — nested callbacks / "callback hell"**
The sell-mode screen opens a second screen inside an `onClick`, which calls `becomeBeggar` inside another `onClick`. Three levels of inline arrow functions with side effects make the flow hard to follow and test. Extract named handler functions.

---

## Medium Impact

**`treasureBox.ts` and `tavern.ts` — near-identical handlers (~90% same code)**
Both roll dice, apply a gold modifier based on the roll, show a result screen. They should share a `handleRollReward(board, updateGameState, roll, config)` helper parameterized by reward formula and screen config.

**`say.ts` — console output duplicated**
The switch statement logs to console AND then a second block mirrors the same logs. One of them is dead code.

**`GameState.ts` — `lastDice` and `circles` are unused**
`lastDice` is initialized to `1` and never updated after that. `circles` is incremented in `passStart` but never read anywhere for game logic. These should be removed or actually used.

**Custom event bus (`gameEvent`) without type safety**
`gameEvent('displayTile', tile)` accepts `any` as payload. A typed event map would catch mismatches at compile time:
```ts
type GameEvents = {
  displayTile: Tile | Record<string, never>;
  setPhase: TurnPhase;
  showDice: null;
  // ...
}
```

**`becomeBeggar.ts` — hardcoded prison position `13`**
The number `13` is used instead of finding the Prison tile by type. If tiles are reordered, beggars end up on the wrong tile silently.

**`App.tsx` — raw `addEventListener`/`removeEventListener` repeated 3×**
The `setPhase`, `showDice`, `logMessage` listeners follow the same pattern. A `useGameEvent(eventName, handler)` custom hook would eliminate the boilerplate.

---

## Code Quality / Readability

**`Tile.ts` — string keys on numeric-indexed objects**
Prices are accessed as `tile.prices['1']` (string) but typed as `{ [level: number]: ... }` (number). Pick one — either define as `Record<1|2|3, ...>` or consistently use string keys.

**`NewGameModal.tsx`, `BoardCanvas.tsx` — `any` type cast**
`(groupsData as any[])`, `tile: any`, `detail as Tile | null` without validation. These hide real type errors; the actual group/tile types are known and should be used.

**`TileCard.tsx` — `window.confirm()` in a React component**
Synchronous browser dialogs block the render thread and can't be styled or tested. Replace with a proper inline confirmation state (`isConfirming: boolean`).

**`sellTile.ts` — `indexOf` for tile lookup is O(n)**
The tile's index in the board is already known at all call sites (it comes from `player.ownedTiles`). Pass the index as a parameter instead of searching for it.

**`ScreenRenderer.tsx` — `try { onClick(); } catch {}` silences errors**
A swallowed catch with no logging makes debugging button handlers invisible. At minimum: `catch (e) { console.error(e); }`.

**`passStart.ts` — tile name string comparison for King check**
`!board.activeTile.name.toLowerCase().startsWith('king')` — same fragility as the `includes()` pattern in `rollAndMove`.

**Inconsistent null coalescing: `??` vs `||`**
`player.gold ?? 0` (correct: only catches null/undefined) mixed with `player.gold || 0` (wrong: treats 0 as falsy). Unify to `??` throughout.

---

## Testing Gap

There are no tests at all for any of the game logic — actions, state transitions, or battle outcome calculations. The deterministic pure functions (`determineBattleOutcome`, `handleSphynx`, `passStart`, `sellTile`) are straightforward to unit test and would catch regressions immediately when rules change.

---

## What's Actually Good

- The external store pattern (`useSyncExternalStore`) for `diceStore`/`screenStore`/`endTurnStore` is clean and avoids prop drilling
- Action files as pure-ish functions with a consistent `(board, updateGameState)` signature is solid
- `gameStateRef` to avoid stale closures in async dice handlers is the correct React pattern
- `Tile.groupColor` as a getter (computed from groups.json) is the right approach
