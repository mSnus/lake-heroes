import React from 'react';
import { BattleOutcome, BattleResolution } from '../../actions/battles/common';
import { resolveTileBattle } from '../../actions/battles/resolveTileBattle';
import { resolveRogueAttack } from '../../actions/battles/resolveRogueAttack';
import { resolveCaravanBattle } from '../../actions/battles/resolveCaravanBattle';
import { resolveDragonBattle } from '../../actions/battles/resolveDragonBattle';
import { resolvePlayerBattle } from '../../actions/battles/resolvePlayerBattle';
import { resolveAmbush, AmbushOutcome } from '../../actions/battles/resolveAmbush';
import { resolveRuinsBattle } from '../../actions/battles/resolveRuinsBattle';
import { showTileEncounterScreen } from '../../actions/afterMoveLogic';
import { showTileClaimScreen } from '../../actions/showTileClaimScreen';
import { setEndTurn } from '../../utils/endTurnStore';
import { showScreen, clearScreen, ScreenConfig } from '../../utils/screenStore';
import { isHeadlessRun } from '../../utils/headlessStore';
import { getOverrides } from '../../utils/overridesStore';
import { BattleScreen, type BattleScreenProps } from '../../components/BattleScreen';
import { BattleSetup } from './battleSetup';
import { runHeadlessBattle } from './headlessBattle';

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

/**
 * Everything BattleScreen's own handleClose does once a fight ends and the
 * player (or bot) moves on -- extracted so the headless path (below) can
 * replicate it exactly instead of a second, divergence-prone copy.
 */
export function handleBattleClose(props: BattleScreenProps, setup: BattleSetup, outcome: BattleOutcome | null): void {
  const { attacker, gameState, updateGameState } = props;
  const { isCaravan, isPlayerBattle, isAmbush, isRogue, isDragon, isTile, defender, tile } = setup;

  if (isCaravan || isPlayerBattle || isAmbush || isRogue) {
    (props as { onClose: () => void }).onClose();
  } else if (isDragon) {
    if (outcome !== 'attacker') setEndTurn();
  } else if (isTile && defender && outcome === 'defender') {
    // Losing a banzai attack on an owned tile returns to the guards
    // encounter instead of ending the turn -- see the identical comment on
    // BattleScreen's own handleClose for why.
    attacker.hasResolvedTileEncounterThisTurn = false;
    showTileEncounterScreen(gameState, updateGameState);
  } else {
    setEndTurn();
    if (isTile && tile && outcome === 'attacker' && tile.owner === attacker.id) {
      showTileClaimScreen({ tile, player: attacker, gameState, updateGameState });
    }
  }
}

/**
 * Fight this battle -- headless straight to a resolved GameState with no
 * animation, or the real interactive BattleScreen -- applying the same
 * post-battle continuation either way. The one place every battle in the
 * game (tile, caravan, dragon, player, ambush, rogue) should be started
 * from, so a headless run and a real one can never resolve differently.
 *
 * Also goes headless for a real, on-screen game when the ⚖️ "headless
 * combats" override is on -- unlike isHeadlessRun(), that doesn't touch
 * toasts/game-log, so everything except the battle animation itself still
 * behaves normally (result toasts, the claim/garrison screen after a win,
 * etc). It does still need to dismiss whatever encounter screen (caravan,
 * ambush, rogue, guards) the attack/defend button was clicked from, since
 * the normal path's showScreen(BattleScreen) call below would otherwise
 * have replaced it -- clearScreen() is a no-op during isHeadlessRun(), so
 * this is safe to call unconditionally here.
 */
export function showBattleScreen(
  props: BattleScreenProps,
  // Reload-restore identifiers (SavedScreen) -- irrelevant headlessly, since
  // nothing ever gets persisted there (screenStore's writes no-op too).
  screenExtras?: Pick<
    ScreenConfig,
    | 'screenType'
    | 'tileIndex'
    | 'defenderId'
    | 'battlefieldUnits'
    | 'ambushAttackerUnits'
    | 'ambushAttackerRiders'
    | 'hordeUnits'
    | 'caravanDefence'
    | 'caravanDefenceRiders'
    | 'caravanPrize'
  >
): void {
  if (isHeadlessRun() || getOverrides().headlessCombats) {
    clearScreen();
    const { setup, resolution } = runHeadlessBattle(props);
    handleBattleClose(props, setup, resolution.outcome);
    return;
  }
  showScreen({ ...screenExtras, content: React.createElement(BattleScreen, props) });
}
