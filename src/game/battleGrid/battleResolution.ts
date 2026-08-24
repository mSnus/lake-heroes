import { BattleOutcome, BattleResolution } from '../../actions/battles/common';
import { resolveTileBattle } from '../../actions/battles/resolveTileBattle';
import { resolveRogueAttack } from '../../actions/battles/resolveRogueAttack';
import { resolveCaravanBattle } from '../../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../../actions/battles/resolveDragonBattle';
import { resolvePlayerBattle } from '../../actions/battles/resolvePlayerBattle';
import { resolveAmbush, AmbushOutcome } from '../../actions/battles/resolveAmbush';
import { resolveRuinsBattle } from '../../actions/battles/resolveRuinsBattle';
import type { BattleScreenProps } from '../../components/BattleScreen';
import { BattleSetup } from './battleSetup';

/**
 * Which real-game outcome a finished grid battle produces -- gold, fame, tile
 * ownership, casualties, all mutated on the same GameState/Player/Tile
 * instances the caller already holds. Shared by BattleScreen (which then
 * plays the result back through its result screen) and the headless economy
 * simulator (which just needs the mutation, not the screen).
 */
export function dispatchBattleResolution(
  props: BattleScreenProps,
  setup: BattleSetup,
  battleOutcome: BattleOutcome,
  atkKilled: number,
  defKilled: number
): BattleResolution {
  const { attacker, gameState } = props;
  const { isDragon, isCaravan, isPlayerBattle, isAmbush, isRuins, isRogue, defender, tile, caravanPrize, caravanSlaves, defence, battlefieldUnits, ambushAttackerUnits, isZombieAmbush } = setup;

  if (isDragon) return resolveDragonBattle(gameState, attacker, atkKilled, battleOutcome);
  if (isCaravan)
    return resolveCaravanBattle(
      gameState,
      attacker,
      { prize: caravanPrize!, slaves: caravanSlaves, defence },
      atkKilled,
      battleOutcome
    );
  if (isPlayerBattle)
    return resolvePlayerBattle(gameState, attacker, defender!, battlefieldUnits!, atkKilled, defKilled, battleOutcome);
  if (isAmbush && isRuins) {
    // In ambush shape: attacker(grid)=monsters, defender(grid)=real player.
    return resolveRuinsBattle(gameState, attacker, defKilled, battleOutcome);
  }
  if (isAmbush) {
    // In ambush: attacker(grid)=NPC, defender(grid)=real player.
    // BattleOutcome 'defender' means the player wins the ambush.
    const ambushOutcome: AmbushOutcome =
      battleOutcome === 'defender' ? 'win' : battleOutcome === 'attacker' ? 'defeat' : 'tie';
    const res = resolveAmbush(gameState, attacker, ambushAttackerUnits!, defKilled, atkKilled, ambushOutcome, isZombieAmbush);
    return {
      outcome: battleOutcome,
      message: res.message,
      victoryBg: ambushOutcome === 'win',
      lostBg: ambushOutcome !== 'win',
    };
  }
  if (isRogue) return resolveRogueAttack(gameState, defender!, tile!, defKilled, battleOutcome);
  return resolveTileBattle(gameState, attacker, defender, tile!, atkKilled, defKilled, battleOutcome);
}
