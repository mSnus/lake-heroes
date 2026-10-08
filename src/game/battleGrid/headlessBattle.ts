import { runGridBattleToCompletion } from './engine';
import { realLossFromGridLoss } from './scale';
import { buildBattleSetup, buildInitialBattleState, BattleSetup } from './battleSetup';
import { dispatchBattleResolution } from './battleResolution';
import { StepTurnOptions } from './types';
import { BattleOutcome, BattleResolution } from '../../actions/battles/common';
import type { BattleScreenProps } from '../../components/BattleScreen';

/**
 * Fight a battle start to finish with no animation and no screens -- the
 * same setup, grid run, and outcome dispatch BattleScreen uses turn by turn,
 * just run straight through. Mutates the same GameState/Player/Tile
 * instances a real fight would (gold, fame, tile ownership, casualties).
 * Returns `setup` alongside the resolution so the caller (showBattleScreen)
 * can feed both into handleBattleClose exactly like BattleScreen's own
 * handleClose would -- there's nothing else left to apply afterward. Used
 * by the headless economy simulator so an AI's battles resolve exactly like
 * a real player's would.
 */
export function runHeadlessBattle(props: BattleScreenProps): { setup: BattleSetup; resolution: BattleResolution } {
  const setup = buildBattleSetup(props);
  const initialState = buildInitialBattleState(setup);

  const opts: StepTurnOptions = {
    attackerFlatBonus: setup.attackerRollBonus,
    defenderPctBonus: setup.garrisonRollBonusPct,
    defenderFlatBonus: setup.defenderRollBonus,
    // Same brawl-only scoping as BattleScreen's own brawlOpts() -- a
    // headless/auto-resolved fight must match what an interactive one of
    // the same mode would do.
    applyEnergyPenalty: setup.board.isBrawl,
  };
  const finalState = runGridBattleToCompletion(initialState, setup.board.isBrawl, opts);

  const attackerLeft = finalState.units.filter((u) => u.side === 'attacker').length;
  const defenderLeft = finalState.units.filter((u) => u.side === 'defender').length;
  const atkGridKilled = setup.attackerGridTotal - attackerLeft;
  const defGridKilled = setup.defenderGridTotal - defenderLeft;
  const atkKilled = realLossFromGridLoss(atkGridKilled, setup.attackerSized.scale);
  const defKilled = realLossFromGridLoss(defGridKilled, setup.defenderSized.scale);

  // Same derivation BattleScreen uses when its own battle ends -- 'tie' also
  // covers the rare case of MAX_ROUNDS exhausted with neither side wiped out.
  const battleOutcome: BattleOutcome =
    finalState.status === 'attacker-win' ? 'attacker' : finalState.status === 'defender-win' ? 'defender' : 'tie';

  const resolution = dispatchBattleResolution(props, setup, battleOutcome, atkKilled, defKilled);
  return { setup, resolution };
}
