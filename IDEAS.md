# Ideas

Brainstorm list of things that might get implemented someday. Unlike TODO.md,
nothing here is committed to — just worth keeping around so we don't lose track.

- Allow banzai mode for the owned-tiles move encounter too (currently only
  claiming unowned tiles supports attacking with fewer units than defence).
- Big army should give a bonus in battle, maybe +1 to the roll for each 10
  extra units beyond what's needed.
- Add a button to pay a fine and leave Prison immediately, without skipping
  the turn (currently the only way out is waiting out the skipped turns).

From an earlier mechanics-brainstorm session (two critic personas — a
strategy gamer and a 12-year-old — judged each idea; these are the ones
that didn't make the cut, kept here in case they're worth revisiting):
- Free-form player-to-player trading. Rejected: kingmaking risk, and no
  negotiation UI exists to support it.
- One-shot scroll/card items. Rejected: duplicates the existing artifact
  system with no clear new niche.
- Morale/luck combat modifiers (extra randomness on top of rolls).
  Rejected: the raze-not-capture battle system is already swingy enough.
- Roaming dragon attacks on tiles (distinct from the already-built Rogue
  Attack, which is a roaming *horde*, not the dragon itself). Rejected:
  redundant with the Joker tile's chaos and felt rubber-band-y in
  playtesting discussion.
- Munchkin-style "Meddling" (interrupt/influence another player's fight).
  Rated only "fine" by both critics — slows down every fight for a payoff
  that isn't really there unless paired with something like roaming
  dragon attacks.
- Branching board paths instead of a single loop. Kid-critic loved it, but
  it breaks the lap-based fog-reveal and King's-Castle gold scaling that
  assume one fixed circuit — would need real rework, not a quick add.
- 10x unit-count scaling (bigger armies, same ratios). Rejected by both:
  mathematically less dramatic battles (round counts balloon), and
  silently breaks untouched constants like FEE_MULTIPLIER/BRAWL_THRESHOLD.

Shelved (not rejected) -- worth rethinking:
- **Karma**: a per-player moral-standing stat that goes negative for cruelty
  and positive for mercy, and biases random events (Joker, Sphynx, Treasure).
  Shelved after analysis; findings for whoever picks it up:
  - Razing is not a choice (`resolveTileBattle.ts`: `claiming = !tile.isOwned()`,
    winning vs an owned tile always razes), and fame already pays +1 for it.
    Charging karma for it would tax the only available move.
  - Over a game the counter would land around -8..+3, near-monotonically down:
    the negative side is fed by razing and caravan gold (in ~89% of caravans),
    the positive side has ~2 slave-freeing events a game, and those are not
    opt-in. It would read as a slow curse, not a balance the player steers.
  - Gold and slaves cannot be separated: 28% of caravans carry both, awarded
    in one bundle (`resolveCaravanBattle.ts`). Freed slaves are already just
    militia, clamped to army slots with the excess silently lost -- so mercy
    would need a new "free / conscript" choice built from scratch.
  - Joker is the worst target: ~once per player per game (it sits on the long
    fork branch only), and only Queen's Gift acts on the lander -- the rest hit
    everyone or the leader. Sphynx (~4.3%/roll) and the treasure chest
    (~6.6%/roll, always the lander) are the biasable ones. Events are already
    ~70% bad, so headroom is toward good, not more bad.
  - Hooks that held up as genuine forks: revenge after the toll is paid
    (`afterMoveLogic.ts`), and Hero's Hour PvP. Both are optional aggression
    with a real alternative on screen.
  - Risk: both-directions biasing can death-spiral a player who falls behind,
    against King's Grace / the anti-leader Joker events pushing the other way.
  - Before building: count fork offers and biased draws per player per game in
    the headless sim; if under ~5, the dial cannot steer behaviour.
- **Property tax on the tile's base price** (planned, not yet built). Taken
  once a lap at the King's Castle, as a share of each owned tile's level-1
  price -- never the upgrade cost. From 40 four-bot sim games, tolls counted as
  income:
  - Targets the leader, unlike a tax on cash: the score leader is the biggest
    payer 56% of the time (chance 25%) and pays ~47% of all tax collected. A
    tax on cash only managed 35%, because leaders turn cash into land.
  - Base price, not paid price: taxing upgrades too made half of all L1->L3
    upgrades gold-negative per lap (every Camp/Tower upgrade -1800, since they
    add units, not gold), so it would quietly stop players upgrading. Taxing
    the base price leaves upgrades untaxed.
  - Size: 20% of base price takes only ~7-9% of gold income; ~50-60% of base
    price per lap gives a 15-25% bite. (20% of the full paid price took 22-24%.)
  - Needs: a rule when a player cannot pay (5-8% of cases; reuse the toll
    sell-tiles/prisoner flow), one net line at the Castle beside the King's
    Grace, and measuring it together with the grace handicap, which already
    zeroes the leader's grace at 1.8x -- or success is punished twice.
  - Bots will not adapt to it; humans will (selling Towers before a lap,
    hoarding cash instead of buying), so it needs a playtest, not just the sim.
