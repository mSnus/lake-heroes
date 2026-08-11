export type BattleSide = 'attacker' | 'defender';
export type UnitKind = 'militia' | 'rider' | 'dragon';

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
}

export interface GridBattleState {
  cols: number;
  rows: number;
  units: GridUnit[];
  turn: number;
  status: 'ongoing' | 'attacker-win' | 'defender-win' | 'tie';
}

export type TurnEventType = 'move' | 'attack' | 'defend' | 'skip' | 'death';

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
