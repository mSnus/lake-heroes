# Caravan

A trade caravan sometimes crosses a player's path. They can raid it for its cargo or let it pass (`src/actions/caravanEncounter.tsx`).

## When it appears

Checked once per turn, after the move, **only when the player lands on an empty road tile**. All of these must hold:

- The game is past its first 2 years.
- The player isn't at, or leaving, Prison.
- The player's army is at least half their militia cap.
- They didn't meet a caravan on their previous turn.
- They haven't met one yet this year (at most 1 per year).

| Karma | Chance per eligible landing |
|---|---|
| Normal | 1/6 (16.7%) |
| Blessed (≥ 3) | ×1.25 → 20.8% |

A caravan is checked before an ambush, so a turn that meets one skips the ambush check.

## The caravan

- **Escort:** mirrors the player's own army, tier by tier. Each tier is 70–100% of the player's militia and riders, at least 1 unit.
- **Guards who fight:** 76.5% of the escort (`CARAVAN_GUARD_RATIO`).

**Cargo**, each kind rolled on its own (`src/game/caravanPrize.ts`):

| Cargo | Chance | Amount |
|---|---|---|
| Gold | 80% | 10🟡 × escort size × 1, 2 or 3 |
| Slaves | 35% | 40–80% of the escort size, at least 1 |
| Horses (Knights only) | 20% | 1–12 |

A caravan always carries gold or slaves; if neither comes up, one is picked in proportion to their chances.

## Raiding it

The player chooses **⚔️ Attack!** or **✖️ Let 'em pass**. Attacking starts a battle against the guards (`src/actions/battles/resolveCaravanBattle.ts`).

**Win:**
- **Gold cargo** arrives split into gold (30–60%), food (10–70% of the rest) and arms (the remainder). The gold part is rounded to 5.
- **Slaves** join as militia, up to the free room under the militia cap; the rest are lost.
- **Horses** mount as many militia into riders as the rider cap allows.
- **Recruits:** 25% chance that some of the beaten guards join the winner, up to 20% of each tier.
- **Karma:** +1 only when the cargo was nothing but slaves (freeing them). Raiding for gold or horses doesn't change karma.

**Draw:** the player loses a quarter of the guards' number in units and collects a quarter of every cargo. Battles are set up not to end in a draw, so this is mostly a fallback.

**Loss:** the caravan gets away; the player keeps only the losses from the battle.

## Bots

A bot attacks when its army power is at least this many times the fighting guards (`shouldAttackCaravan`, `fightThreshold.caravan` in `src/ai/characters.ts`):

| Personality | Attacks at |
|---|---|
| Warrior | 1.5× |
| Wizard | 1.7× |
| Explorer | 2× |

Otherwise it lets the caravan pass.
