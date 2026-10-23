import React, { useEffect, useState } from 'react';
import { GameState } from '../../game/GameState';
import '../../styles/modal.css';
import GameModal from './GameModal';
import { getOverrides } from '../../utils/overridesStore';
import { UnitTier } from '../../game/army';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { DecoratedButton } from '../ui/DecoratedButton';
import { ArmyDisplay } from '../ui/ArmyDisplay';
import { SquadHirePanel } from '../ui/SquadHirePanel';
import { Gold } from '../snippets/Gold';
import { KingsContract } from '../../game/kingsContracts';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';
import { planArmyPurchase } from '../../ai/botPlans';

interface BuyUnitsModalProps {
  gameState: GameState;
  /** Only a contract issued on THIS visit is shown; carried-over ones are not. */
  newContract?: KingsContract | null;
  onBuy: (amount: number, tier: UnitTier) => void;
  onSell: (tier: UnitTier, amount: number) => void;
  onUpgrade: (count: number) => void;
  onSkip: () => void;
}

const KingsCastleModal: React.FC<BuyUnitsModalProps> = ({
  gameState,
  newContract,
  onBuy,
  onSell,
  onUpgrade,
  onSkip,
}) => {
  const t = useT();
  const player = gameState.activePlayer;

  // onBuy/onSell mutate `player` in place and re-render the app's own
  // gameState tree, but this modal is a static `content:` element handed
  // to screenStore once at mount — nothing re-invokes it on its own. Bump
  // this to force a re-render so the squad display and gold/fame-derived
  // text below reflect the change immediately instead of on the next
  // unrelated re-render.
  const [, forceRerender] = useState(0);
  const handleBuy = (amount: number, tier: UnitTier) => {
    onBuy(amount, tier);
    forceRerender((v) => v + 1);
  };

  const handleSell = (tier: UnitTier, count: number) => {
    onSell(tier, count);
    forceRerender((v) => v + 1);
  };

  const handleUpgrade = (count: number) => {
    onUpgrade(count);
    forceRerender((v) => v + 1);
  };

  const contract = newContract ?? null;
  const contractTile = contract ? gameState.tiles[contract.tilePosition] : null;

  const canRecruitRiders = player.isKnight;

  // Neither tier has any room left — gold or the fame-based caps block both
  // militia and riders. Shown as a single "can't recruit" message instead
  // of the full recruiting panel (the army display and sell buttons stay
  // usable either way, since selling frees room).
  const militiaMax = Math.min(Math.floor(player.gold / getOverrides().militiaPrice), player.armyRoom('militia'));
  const ridersMax = canRecruitRiders
    ? Math.min(Math.floor(player.gold / getOverrides().riderPrice), player.armyRoom('riders'))
    : 0;
  const atMax = militiaMax <= 0 && ridersMax <= 0;
  // Recruiting can also be blocked purely by empty pockets — only mention
  // a full army when no recruitable tier has room left.
  const armyFull = player.armyRoom('militia') <= 0 && (!canRecruitRiders || player.armyRoom('riders') <= 0);

  useEffect(() => {
    if (!player.isComputer) return;
    const plan = planArmyPurchase(player);
    const timer = setTimeout(() => {
      for (const step of plan) {
        if (step.kind === 'sell') onSell(step.tier, step.count);
        else if (step.kind === 'upgrade') onUpgrade(step.count);
        else onBuy(step.count, step.tier);
      }

      onSkip();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/king.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content" style={{ color: `white`, fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('kingsCastle.title')}</h2>
        <h3>{gameState.kingRewardMessage}, <PlayerLabel player={player} /></h3>

        <h3>
          {tJsx('kingsCastle.moneyAndFame', {
            gold: (
              <span className="value">
                <Gold amount={player.gold} />
              </span>
            ),
            fame: <span className="value">{player.fame}🏆</span>,
          })}
        </h3>

        {contract && contractTile && (
          <h3 className='king-contract' style={{ whiteSpace: 'pre-line' }}>
            {tJsx('kingsCastle.newContract', {
              tileName: contractTile.name,
              award: <span className="value">{contract.award}</span>,
            })}
          </h3>
        )}

        <ArmyDisplay
          militia={player.militia}
          riders={player.riders}
          capacity={player.armyCapacity}
          showRiders={player.isKnight || player.riders > 0}
          onSell={handleSell}
          onUpgrade={handleUpgrade}
          canUpgradeToRiders={canRecruitRiders}
          playerGold={player.gold}
          className="squad-display-large"
        />

        {atMax ? (
          <h3 style={{ whiteSpace: 'pre-line' }}>
            {t(armyFull ? 'kingsCastle.cannotRecruit' : 'kingsCastle.cannotRecruitNoMoney')}
          </h3>
        ) : (
          <SquadHirePanel player={player} showRiders={canRecruitRiders} onBuy={handleBuy} />
        )}

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onSkip}>{t('kingsCastle.iAmTheGreatest')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default KingsCastleModal;
