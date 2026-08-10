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
