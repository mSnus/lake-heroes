# Refactoring Plan

Created: 2026-02-25

## Phase 1 — Bug Fixes (highest priority)

### 1.1 Stale closure in App.tsx (critical)
`handleDiceRollAndMove` closes over `gameState` at definition time, so it always calls
`rollAndMove` with stale state. Fix: use a ref to always hold latest state.
```ts
const gameStateRef = useRef(gameState);
useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
const handleDiceRollAndMove = () => rollAndMove(gameStateRef.current, ...);
```
Same issue exists in `handleStartGame`'s useCallback deps.

### 1.2 Sphynx logic bugs (src/actions/sphynx.ts)
- Roll 1-2: check should be `player.gold > 0`, not `player.gold === 0`
- Roll 6: comment says +20% gold, code gives +50%; align code to 20%

### 1.3 ownedTiles inconsistency
- `buyTile.ts` pushes position index into `player.ownedTiles`
- `sellTile.ts` filters by `tile.name` — will silently fail
- Fix: standardize on position indices everywhere; update sellTile filter

### 1.4 Prison while owned (from TODO)
Players in prison should not receive passive income when others land on tiles they own.
Add check in `payFee.ts`: if `tileOwner.turnsToSkip > 0`, skip fee transfer (or send to bank).

## Phase 2 — Missing Game Features (from TODO.md)

### 2.1 Fight loss → pay fee
In `fightTile.ts`, when the fight is lost the fee must still be paid.
If player can't pay → trigger sell-to-pay flow or bankruptcy.

### 2.2 Sell-to-pay flow
New menu type `'sell-to-pay'` already exists in MenuState but isn't fully implemented.
Show player's owned tiles with sell prices; after each sale re-check if fee is covered.

### 2.3 Dragon fight win condition
When `player.units >= 50`, offer dragon challenge at turn start (before dice roll).
Win (roll ≥ 4): game-over victory screen.
Lose: lose half units + all gold.

## Phase 3 — Type Safety

### 3.1 Remove `as any` in App.tsx
Define `SavedGameState` interface matching the serialized shape. Replace `saved as any`
and `p: any` with typed alternatives.

### 3.2 Type-safe events
Create a typed event map:
```ts
type GameEventMap = {
  setPhase: TurnPhase;
  diceRolled: number;
  logMessage: LogMessage;
  ...
};
```
Make `gameEvent<K>(name: K, detail: GameEventMap[K])` generic.

### 3.3 Tile rehydration typing
`rehydrateSavedTiles` currently receives `any`; give it a typed parameter.

## Phase 4 — Architecture / Code Quality

### 4.1 Move handleBuyUnits to an action file
King/buy-units logic lives in App.tsx but should be `src/actions/buyUnits.ts`
to match the pattern for all other actions.

### 4.2 Extract game constants
`MONEY_START`, `UNITS_START`, etc. are scattered across files. Consolidate into
`src/game/constants.ts`.

### 4.3 updateGameState doesn't need double-clone
Currently App.tsx `updateGameState` does `Object.assign(new GameState(...), {...gameState})`
AND many actions also do the same clone before calling it. Pick one place for the clone.

### 4.4 Deduplicate `if (!board) return` guards
All 20 actions start with this guard. Could be a wrapper or at minimum a shared type guard
helper.

## Phase 5 — Polish

### 5.1 Re-enable toast notifications
`say.ts` has toast levels (info/success/warning/error) but success/info may be suppressed.
Audit and re-enable as appropriate.

### 5.2 Error boundary
Wrap `<App>` or `<div id="mainContainer">` in a React error boundary to prevent white
screen on unexpected errors.

### 5.3 Memoize BoardCanvas groupsByName
`BoardCanvas` recomputes `groupsByName` map every render. Move to `useMemo`.
