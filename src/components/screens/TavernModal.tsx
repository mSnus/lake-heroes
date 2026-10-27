import React, { useEffect } from 'react';
import { GameState } from '../../game/GameState';
import '../../styles/modal.css';
import GameModal from './GameModal';
import { DecoratedButton } from '../ui/DecoratedButton';
import { Gold } from '../snippets/Gold';
import { Fame } from '../snippets/Fame';
import { useT } from '../../i18n';
import { tJsx } from '../../i18n/tJsx';

interface TavernModalProps {
  gameState: GameState;
  /** Pre-rendered HTML for the dice-roll result (joined/full-note message). */
  joinedHtml: string;
  onSkip: () => void;
}

/** Tavern's post-roll screen: just the free militia (or riders) the roll
 * won -- recruiting itself now lives in the Army screen, always open at the
 * same premium rate the Tavern used to charge (see actions/tavern.ts's
 * tavernMilitiaPrice/tavernRiderPrice), so there's nothing left to do here
 * but read the result and move on. */
const TavernModal: React.FC<TavernModalProps> = ({ gameState, joinedHtml, onSkip }) => {
  const t = useT();
  const player = gameState.activePlayer;

  // A bot has nothing left to decide here (recruiting moved to the Army
  // screen, which bots never open) -- just reads the result and moves on.
  useEffect(() => {
    if (!player.isComputer) return;
    const timer = setTimeout(onSkip, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GameModal
      className="game-modal"
      backgroundImage="assets/screens/tavern.jpg"
      noBorder={true}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      <div className="modal-content tavern-screen" style={{ color: 'white', fontFamily: 'Texturina' }}>
        <h2 className="game-title">{t('tavern.title')}</h2>
        <h3 style={{ whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: joinedHtml }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          {tJsx('tavern.moneyAndFame', {
            gold: (
              <span className="value">
                <Gold amount={player.gold} />
              </span>
            ),
            fame: (
              <span className="value">
                <Fame amount={player.fame} />
              </span>
            ),
          })}
        </div>

        <div
          className="button-group"
          style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <DecoratedButton onClick={onSkip}>{t('tavern.newFolksWelcome')}</DecoratedButton>
        </div>
      </div>
    </GameModal>
  );
};

export default TavernModal;
