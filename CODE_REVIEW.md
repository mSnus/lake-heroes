# Code Review — Brawl + Encounter Timing Refactor

Branch: `master` · Reviewed: 2026-06-16

Scope: last 5 commits (`e9727ee` → `HEAD`) — brawl mode, encounter-check move from `endTurn` to `rollAndMove`, collapsible shield menu.

---

## Findings

### 1. `proceedWithMove` called fire-and-forget inside encounter callbacks

**File:** `src/actions/rollAndMove.ts:139`  
**Severity:** High

`checkCaravanEncounter` and `checkAmbushEncounter` accept `onContinue: () => void` and call it from synchronous button `onClick` handlers without `await`. `proceedWithMove` is `async`, so any error thrown inside it (e.g. a tile handler throwing mid-movement) produces an unhandled promise rejection — `setEndTurn()` is never reached and the turn silently stalls.

---

### 2. Stale `board` closure — movement runs on pre-battle snapshot after ambush

**File:** `src/actions/rollAndMove.ts:22`  
**Severity:** High

`proceedWithMove` closes over the `board` parameter of `rollAndMove`. `AmbushScreen` calls `updateGameState(board)` to apply unit/gold changes from the fight, then fires `onClose → proceedWithMove()`. But `proceedWithMove` still holds the original `board` reference, not `gameStateRef.current`. Movement and `afterMoveLogic` therefore run on the pre-battle state (missing unit losses or freed-slave gains). The `gameStateRef` pattern in `App.tsx` exists exactly for this reason but is bypassed here.

---

### 3. Dragon weak-player attack no longer grants a re-roll

**File:** `src/actions/dragonEncounter.ts:126`  
**Severity:** Medium

Old code passed `() => gameEvent('showDice', null)` as `onContinue` — after a dragon attack the player got a fresh dice roll. New code passes `proceedWithMove`, so movement now executes immediately with the already-computed roll. Players who survive a dragon attack and expect to roll again are silently moved instead.

---

### 4. Phase is `'rolling'` during encounter screens

**File:** `src/actions/rollAndMove.ts:50`  
**Severity:** Medium

Encounters are now checked after `gameEvent('setPhase', 'rolling')` fires (line 39), so dragon/caravan/ambush screens render while the game is in `rolling` phase instead of the old `before-move`. Any code gating on phase (keyboard shortcut guard in `ActionBar`, `CurrentTile` visibility) behaves differently during encounters than before this refactor.

---

### 5. Brawl tie zeroes both unit refs despite no kills

**File:** `src/components/BattleScreen.tsx:262` · `src/components/AmbushScreen.tsx:140`  
**Severity:** Low

In the brawl tie branch, `newDefLeft = 0` and `newAtkLeft = 0` are set even though `defKills = 0` and `atkKills = 0`. The internal refs `atkUnitsLeftRef` / `defUnitsLeftRef` are incorrectly zeroed. The emoji grid display is unaffected (it reads `displayedAtkKilled` / `displayedDefKilled` state, not the refs), but if brawl ever becomes multi-round the next round would see 0 units remaining and resolve instantly. Both refs should retain `defence` / `attackerUnits` on a tie.

---

### 6. Brawl threshold is a magic number duplicated across two components

**File:** `src/components/BattleScreen.tsx:103` · `src/components/AmbushScreen.tsx:33`  
**Severity:** Low (cleanup)

`isBrawl = defence <= 5` appears in both components with no shared constant. The threshold was recently changed from 6 → 5 (commit `e9727ee`) and both comments still say `≤6 units` — evidence of drift. A `BRAWL_THRESHOLD = 5` in `constants.ts` or `battles/common.ts` would prevent this, and the brawl round logic itself (kill/survivor computation) is duplicated verbatim and belongs in a `computeBrawlRound(aRoll, dRoll, units)` helper in `common.ts`.

---

### 7. Shield menu has no close-on-outside-click or Escape handler

**File:** `src/components/ShieldColumn.tsx:24`  
**Severity:** Low (UX)

`menuOpen` is only cleared by clicking the 🐲 toggle again or clicking a menu item. Tapping anywhere on the board canvas while the menu is open leaves it stuck for the rest of the turn. A `useEffect` adding a `mousedown` listener on `document` (or a transparent backdrop element) would fix this.

---

### 8. Brawl round logic belongs in `battles/common.ts`, not in components

**File:** `src/components/BattleScreen.tsx:248` · `src/components/AmbushScreen.tsx:124`  
**Severity:** Low (architecture)

The project pattern is: battle math lives in `src/actions/battles/` (resolvers + `common.ts`), components handle animation state only. The brawl kill/survivor computation is domain logic embedded in React `useCallback`s. A `computeBrawlRound(aRoll, dRoll, units)` helper in `common.ts` would centralise the rule, make it testable without mounting a component, and eliminate the duplication noted in finding 6.

---

## Already fixed in this session

- **Caravan toast wrong for slave caravans** — `BattleScreen.tsx:154` now uses `🥷` for guard count in caravan mode, distinguishing guards from the `🧍` slave-prize emoji.
- **Units not lost on caravan defeat** — `isBrawl` now excludes caravan battles (`!isCaravan`), so `resolveCaravanBattle` always receives real kill counts and applies proper unit loss.
