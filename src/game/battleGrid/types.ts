export type BattleSide = 'attacker' | 'defender';
export type UnitKind = 'militia' | 'rider' | 'dragon' | 'zombie';

export interface GridUnit {
  id: string;
  side: BattleSide;
  kind: UnitKind;
  hp: number;
  maxHp: number;
  col: number;
  row: number;
  /** Fixed at creation — the single source of truth for every tie-break
   * (turn order, target selection, movement candidates), so a battle replays
   * identically given the same RNG sequence. */
  stableIndex: number;
  /** How many turns in a row this unit has just retreated (0 if its most
   * recent turn was anything else — fighting, moving normally, or standing
   * still). Capped at 2 in a row before it's forced to fight instead. */
  retreatStreak: number;
  /** Total times this unit has broken contact to a safe cell (wounded
   * pullback) — a lifetime cap (not consecutive) that guarantees a wounded
   * unit eventually commits to fighting instead of kiting forever. */
  safetyMoves: number;
  /** Turns this unit still may not swap for. Set when it swaps so it sits
   * the next turn out, then ticks back to 0 — stops a pair from trading
   * places every single turn instead of ever fighting. */
  swapCooldown: number;
  /** Stamina for attacking -- set to its kind's max at battle start (see
   * energyFor in engine.ts), spent -1 per attack this unit makes, floored
   * at 0. At 0, this unit's attack roll is cut to
   * ENERGY_DEPLETED_DAMAGE_MULT of what it would otherwise be. Fully
   * restored at the end of any turn this unit neither moved nor
   * attacked. Nothing else (AI decisions, retreat/swap thresholds, etc.)
   * reacts to energy yet -- only the attack roll itself. */
  energy: number;
  /** Per-unit damage-roll override, set only by the battle simulator (see
   * simulate.ts) to give one side a custom range independent of the live
   * kind-based overrides. Undefined for every real-game unit, which keeps
   * the normal kind+getOverrides() lookup exactly as before. */
  dmgMin?: number;
  dmgMax?: number;
}

export interface BattleObstacle {
  col: number;
  row: number;
  /** One of OBSTACLE_EMOJIS (engine.ts) -- purely cosmetic, picked at
   * random per obstacle when the battle is created. */
  emoji: string;
}

export interface GridBattleState {
  cols: number;
  rows: number;
  units: GridUnit[];
  /** Impassable terrain cells, generated once up front (before either army
   * is placed) and fixed for the rest of the battle -- no unit may ever
   * move onto one. See OBSTACLE_RATIO in engine.ts. */
  obstacles: BattleObstacle[];
  turn: number;
  status: 'ongoing' | 'attacker-win' | 'defender-win' | 'tie';
}

/** 'block' fires alongside 'defend' when that defence roll fully absorbed
 * the incoming attack (net damage 0) -- a purely cosmetic event, used only
 * to flash 🛡️ on the units that actually stopped a hit. */
export type TurnEventType = 'move' | 'attack' | 'defend' | 'block' | 'skip' | 'death';

export interface TurnEvent {
  type: TurnEventType;
  unitId: string;
  side: BattleSide;
  kind: UnitKind;
  targetId?: string;
  from?: { col: number; row: number };
  to?: { col: number; row: number };
  roll?: number;
  damage?: number;
  /** True on the 'attack' event whose hit landed as a critical -- killed its
   * (wounded) target outright regardless of remaining HP. See
   * CRITICAL_HIT_CHANCE in engine.ts. */
  critical?: boolean;
}

export interface TurnResult {
  state: GridBattleState;
  events: TurnEvent[];
}

export interface StepTurnOptions {
  rng?: () => number;
  /** Applied to every roll (attack/defence alike) a side's units make this
   * turn: `roll = round(base * (1 + pctBonus) + flatBonus)` — mirrors the
   * old single-duel-roll formula (fortification % bonus, then a flat
   * artifact bonus on top), just applied per-unit-roll instead of once. */
  attackerPctBonus?: number;
  attackerFlatBonus?: number;
  defenderPctBonus?: number;
  defenderFlatBonus?: number;
}
