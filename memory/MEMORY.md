# Lake Heroes Board Game Simulator - Memory

## Project Overview
React/TypeScript board game simulator. Monopoly-like game with gold/units resources, tile ownership, combat, and special tiles.

## Stack
- React 18 + TypeScript + Vite
- react-toastify for notifications (currently underused)
- No Redux/Zustand — custom modal store (useSyncExternalStore)
- LocalStorage persistence

## Key Paths
- `src/App.tsx` — root; holds gameState, menu state, event listeners
- `src/game/GameState.ts` — GameState class (core state)
- `src/game/Player.ts` — Player class
- `src/game/Tile.ts` — Tile class (pricing, defense, ownership)
- `src/game/TileSet.ts` — tile construction/rehydration from JSON
- `src/actions/` — 20+ pure action functions (rollAndMove, endTurn, etc.)
- `src/utils/events.ts` — gameEvent() custom event dispatcher
- `src/utils/modalStore.ts` — showModal/closeModal + useModal hook
- `src/settings/` — JSON configs: tiles.json, groups.json, map.json, players.json

## Architecture Patterns
- Event-driven: `gameEvent('setPhase', ...)` drives turn phase transitions
- Actions are functions: `action(board, updateGameState, setMenu)`
- State cloning: `Object.assign(new GameState(...), {...gameState})` pattern
- Modal handlers passed as closures to showModal()

## Refactoring Complete (2026-02-25)
All 5 phases done. Zero TypeScript errors. See `memory/refactoring-plan.md` for details.

### Key Changes Made
- **Stale closure**: `gameStateRef` ref in App.tsx; `updateGameState` is `useCallback`
- **Sphynx**: fixed gold check (`> 0`) and gain multiplier (20%)
- **sellTile**: filters `ownedTiles` by position index (not name)
- **payFee**: owner in prison collects nothing
- **fightTile**: on loss, must pay fee or sell/bankrupt
- **afterMoveLogic**: sell-to-pay now uses correct `player.ownedTiles` index
- **Dragon fight**: 50+ units → dragon challenge menu (`fightDragon.ts`); `GameState.gameOver`
- **Types**: `SavedGameState` interface; no `as any` in restore path; `TileCard` prop typed
- **Constants**: `src/game/constants.ts`; `Tile.ts` imports from it directly (no game→component dep)
- **buyUnits**: moved from App.tsx inline to `src/actions/buyUnits.ts`
- **Toasts**: all levels re-enabled in `say.ts`
- **ErrorBoundary**: wraps App in `index.tsx`

## Architecture Patterns
- Event-driven: `gameEvent('setPhase', ...)` drives turn phase transitions
- Actions are functions: `action(board, updateGameState, setMenu)`
- State cloning: `updateGameState(board)` in App.tsx does `Object.assign(new GameState(...), {...gs})`
- Modal handlers passed as closures to showModal()

## See Also
- `memory/refactoring-plan.md` for detailed refactoring plan
