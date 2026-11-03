import React, { useEffect } from 'react';
import { GameState } from '../../game/GameState';
import { Resource, tradersBuyPrice, tradersSellPrice, tradersExchangeBatch } from '../../game/resources';
import GameModal from './GameModal';
import { DecoratedButton } from '../ui/DecoratedButton';
import { ResourceTradeBlock } from './ResourceTradeBlock';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { Food } from '../snippets/Food';
import { Arms } from '../snippets/Arms';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';
import '../../styles/modal.css';
import '../../styles/HarvestModal.css';

interface TravelingTradersModalProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
  /** Whichever resource the fair is bargaining on this time (see
   * actions/workersEncounter.tsx) -- halved buy price, doubled sell price,
   * and a flat 1:1 exchange rate (both ways) instead of the Harvest's 3:2. */
  demandResource: Resource;
  onClose: () => void;
}

/**
 * Traveling Traders: a random encounter (see actions/workersEncounter.tsx,
 * which fires this 50% of the time in place of the Workers hire screen) --
 * the same buy/sell/exchange block as the Harvest (ResourceTradeBlock), just
 * no income/King's Grace to show, and one resource trades on better terms.
 */
const TravelingTradersModal: React.FC<TravelingTradersModalProps> = ({
  gameState,
  updateGameState,
  demandResource,
  onClose,
}) => {
  const t = useT();
  const player = gameState.activePlayer;
  const resourceIcon = demandResource === 'food' ? <Food amount="" /> : <Arms amount="" />;

  const buyPrice = (r: Resource) => tradersBuyPrice(demandResource, r);
  const sellPrice = (r: Resource) => tradersSellPrice(demandResource, r);

  // A live bot doesn't shop here -- it already hires every turn through its
  // own regular budget (see ai/botPlans.ts's planTurnHire) -- so this just
  // moves it along, same delay as every other self-driving bot screen.
  useEffect(() => {
    if (!player.isComputer) return;
    const timer = setTimeout(onClose, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/caravan.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div
        className="modal-content tavern-screen harvest-screen"
        style={{ color: 'white', fontFamily: 'HeroesTextured' }}
      >
        <h2 className="text-title" style={{ marginBottom: 0 }}>
          {t('travelingTraders.title')}
        </h2>
        <h3>
          <PlayerLabel player={player} bold />
        </h3>
        <div className="harvest-stats">
          <Fame amount={player.fame} />
          <Gold amount={player.gold} />
          <Food amount={player.food} />
          <Arms amount={player.arms} />
        </div>

        <div className="harvest-double-income-note">
          {tJsx('travelingTraders.demand', { resource: resourceIcon })}
        </div>

        <ResourceTradeBlock
          player={player}
          onTrade={() => updateGameState(gameState)}
          buyPrice={buyPrice}
          sellPrice={sellPrice}
          exchangeBatch={tradersExchangeBatch}
        />

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onClose}>{t('travelingTraders.close')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default TravelingTradersModal;
