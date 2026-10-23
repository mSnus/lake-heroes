import { addYearIncome } from '../game/income';
import React from 'react';
import { GameState } from '../game/GameState';
import { showScreen, clearScreen } from '../utils/screenStore';
import { setEndTurn } from '../utils/endTurnStore';
import { isHeadlessRun } from '../utils/headlessStore';
import { buyUnits } from './buyUnits';
import { sellUnits } from './sellUnits';
import { upgradeSquad } from './upgradeSquad';
import KingsCastleModal from '../components/screens/KingsCastleModal';
import { say, narrate } from '../utils/say';
import { issueKingsContract } from '../game/kingsContracts';
import { computeAnnualReward } from '../game/kingsGrace';
import { planArmyPurchase } from '../ai/botPlans';
import { t } from '../i18n';

export function handleKingCastle(
  board: GameState | null,
  updateGameState: (board: GameState) => void
) {
  if (!board) return;
  if (board.turns === 0) return;

  console.log('Action: king castle for', board.activePlayer);

  const player = board.activePlayer;
  // Only roll for a contract, and grant King's Grace, the first time this
  // screen opens per turn -- otherwise closing the modal and re-clicking
  // the King's Castle tile would keep re-rolling the contract and re-paying
  // the grace for free.
  let contract = null as ReturnType<typeof issueKingsContract>;
  if (!player.hasCheckedKingsContractThisTurn) {
    player.hasCheckedKingsContractThisTurn = true;
    contract = issueKingsContract(board, player);
    if (contract) {
      const tileName = board.tiles[contract.tilePosition]?.name ?? t('king.aTile');
      say(t('king.contractOffered', { tileName, award: contract.award }), 'success');
      narrate(t('king.narrateVisitContract', { playerName: player.name, tileName, award: contract.award }));
    } else {
      narrate(t('king.narrateVisit', { playerName: player.name }));
    }

    // King's Grace: the same Yearly Bonus formula (see game/kingsGrace.ts),
    // but paid to this one player immediately for landing directly on the
    // Castle, rather than to everyone at the next calendar year end.
    const grace = computeAnnualReward(board, player);
    const graceMilitiaGranted = grace.tileUnits + grace.kingsMilitia;
    player.gold += grace.totalGold;
    player.units += graceMilitiaGranted;
    player.gainRiders(grace.kingsRiders);

    const graceUnitsGranted = graceMilitiaGranted + grace.kingsRiders;
    addYearIncome(player, { gold: grace.totalGold, units: graceUnitsGranted });
    board.kingRewardMessage = t('king.kingsGrace');
    if (grace.totalGold > 0 || graceUnitsGranted > 0) {
      const parts: string[] = [];
      if (grace.totalGold > 0) parts.push(`${grace.totalGold}🟡`);
      if (graceUnitsGranted > 0) parts.push(`${graceUnitsGranted}👬`);
      const summary = parts.join(` ${t('common.and')} `);
      say(t('king.kingsGraceReceived', { playerName: player.name, summary }), 'success');
    }

    updateGameState(board);
  }

  // Same decision KingsCastleModal's own self-drive effect makes.
  if (isHeadlessRun()) {
    for (const step of planArmyPurchase(player)) {
      if (step.kind === 'sell') sellUnits(board, step.count, updateGameState, step.tier);
      else if (step.kind === 'upgrade') upgradeSquad(board, step.count, updateGameState);
      else buyUnits(board, step.count, updateGameState, step.tier);
    }

    setEndTurn();
    return;
  }

  showScreen({
    screenType: 'kings-castle',
    content: (
      <KingsCastleModal
        gameState={board}
        newContract={contract}
        onBuy={(amount, tier) => {
          buyUnits(board, amount, updateGameState, tier);
        }}
        onSell={(tier, amount) => {
          sellUnits(board, amount, updateGameState, tier);
        }}
        onUpgrade={(count) => {
          upgradeSquad(board, count, updateGameState);
        }}
        onSkip={() => {
          clearScreen();
          setEndTurn();
        }}
      />
    ),
  });
}
