import React from 'react';
import { GameState } from '../../game/GameState';
import '../../styles/CurrentPlayer.css';
import { sayLocal } from '../../utils/say';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { playerTurnIncome, playerRawTurnIncome } from '../../game/income';
import { getArtifact } from '../../game/artifacts';
import { ArmyDisplay } from '../ui/ArmyDisplay';
import { Gold } from '../snippets/Gold';
import { Food } from '../snippets/Food';
import { Arms } from '../snippets/Arms';
import { Tower } from '../snippets/Tower';
import { GarrisonsScreen } from '../screens/GarrisonsScreen';
import { ArmyScreen } from '../screens/ArmyScreen';
import RealmOverviewScreen from '../screens/RealmOverviewScreen';
import { gameEvent } from '../../utils/events';
import { showScreen } from '../../utils/screenStore';
import { handleKingCastle } from '../../actions/king';
import { openStablesHireOnly } from '../../actions/stables';
import { useT } from '../../i18n';
import Militia from '../snippets/Militia';
import Fame from '../snippets/Fame';

interface CurrentPlayerProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const activePlayer = gameState.activePlayer;

  const openKingdomOverview = () =>
    showScreen({ content: <RealmOverviewScreen gameState={gameState} /> });

  const handleTileNameClick = () => {
    if (gameState.activeTile.id === 'king-castle') {
      handleKingCastle(gameState, updateGameState);
    } else if (gameState.activeTile.id === 'stables') {
      openStablesHireOnly(gameState, updateGameState);
    } else {
      gameEvent('displayTile', gameState.activeTile);
    }
  };

  const turnIncome = playerTurnIncome(gameState, activePlayer);
  // playerTurnIncome clamps units to remaining militia capacity (income
  // always lands on militia), so a full army reads as 0 units income --
  // indistinguishable from genuinely producing none. Tell those apart with
  // the unclamped figure: only a full army that WOULD be earning units gets
  // the "max capacity" message instead of a silently blank income line.
  const atUnitCapacity =
    playerRawTurnIncome(gameState, activePlayer).units > 0 &&
    activePlayer.armyRoom('militia') <= 0;
  // Fame 1 is in the lowest army-cap bracket -- a player stuck there
  // with no unit income at all (not even the capped-out case above) is
  // nudged toward the fix rather than shown a blank income line.
  const noUnitIncomeAtFame1 = !atUnitCapacity && turnIncome.units === 0 && activePlayer.fame === 1;
  const ownedTileCount = gameState.tiles.filter(
    (tile) => tile && tile.owner === activePlayer.id && !tile.isYielded
  ).length;
  const totalGarrison = gameState.tiles.reduce(
    (sum, tile) =>
      tile && tile.owner === activePlayer.id ? sum + tile.garrisonMilitia + tile.garrisonRiders : sum,
    0
  );
  // Past three, the names stop fitting on one line and wrap into a block that
  // crowds out the row above -- so they drop away and the icons grow instead,
  // which keeps them individually identifiable at a glance.
  const iconOnlyArtifacts = activePlayer.artifacts.length > 3;

  return (
    <div className="player-pane-wrapper">
      <div className="current-player player-stats-data">
        {/* fame */}
        <div
          className="player-stats-fame-wrap"
          id="statsFame"
          onClick={openKingdomOverview}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="player-stats-hint fame-icon"
            style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
          >
            {activePlayer.fame ?? 1}
          </div>
          <Fame amount={''} />
        </div>

        <div className="player-position">
          <span onClick={openKingdomOverview} style={{ cursor: 'pointer' }}>
            <PlayerLabel player={activePlayer} />
          </span>

          <span>{t('currentPlayer.isAt')}</span>
          <span
            style={{ color: gameState.activeTile.groupTextColor, cursor: 'pointer' }}
            onClick={handleTileNameClick}
          >
            {gameState.activeTile.name}{' '}
          </span>
        </div>
      </div>

      <div className="player-pane">
        <div className="player-stats-main-row">
          <img src="assets/sprites/banner.svg" alt="🚩" className="banner-icon" />
          <div className="player-stats-data player-stats-army" id="statsArmy">
            <div
              onClick={() =>
                showScreen({
                  content: React.createElement(ArmyScreen, {
                    gameState,
                    player: activePlayer,
                    updateGameState,
                  }),
                })
              }
              style={{ cursor: 'pointer' }}
            >
              <div>
                <ArmyDisplay
                  militia={activePlayer.militia}
                  riders={activePlayer.riders}
                  capacity={activePlayer.armyCapacity}
                  showRiders={activePlayer.isKnight || activePlayer.riders > 0}
                  spriteColor={activePlayer.image}
                  isKnight={activePlayer.isKnight}
                  className="player-stats-army-slots"
                />
              </div>

              {turnIncome.units > 0 && (
                <div className="player-stats-income-row">
                  <span className="player-stats-turn-income player-stats-army">
                    <Militia amount={`+${turnIncome.units}`} color={activePlayer.image} knight={activePlayer.isKnight} />
                  </span>
                </div>
              )}
            </div>

            <div
              className="player-stats-garrison-row"
              onClick={() =>
                showScreen({
                  content: React.createElement(GarrisonsScreen, {
                    gameState,
                    player: activePlayer,
                    updateGameState,
                  }),
                })
              }
              style={{ cursor: 'pointer' }}
            >
              <span className="squad-chunk">
                <span className="squad-badge">
                  <Tower where="before" />
                  <Militia amount={totalGarrison} color={activePlayer.image} knight={activePlayer.isKnight} />
                </span>
              </span>
            </div>
          </div>
        </div>

        {(atUnitCapacity || noUnitIncomeAtFame1) && (
          <div className="player-stats-income-hint">
            <span className="player-stats-turn-income">
              {atUnitCapacity
                ? t('currentPlayer.maxCapacityReached', { fame: activePlayer.fame })
                : noUnitIncomeAtFame1
                  ? t('currentPlayer.gainMoreFame')
                  : ''}
            </span>
          </div>
        )}

        {/* wealth */}
        <div
          className="player-stats-data player-stats-gold"
          id="statsOwnedResources"
          onClick={openKingdomOverview}
        >
          <div className="player-stats-inline-row">
            <img src="assets/sprites/moneybag.svg" alt="🟡" className="gold-icon" />

            <strong>
              <Gold amount={activePlayer.gold ?? 0} />
            </strong>

            {turnIncome.gold > 0 && (
              <div className="player-stats-income-row">
                <span className="player-stats-turn-income">+{turnIncome.gold ?? 0}</span>
              </div>
            )}
          </div>

          <div className="player-stats-inline-row">
            <strong>
              <Food amount={activePlayer.food ?? 0} />
            </strong>
            {turnIncome.food > 0 && (
              <span className="player-stats-turn-income">+{turnIncome.food}</span>
            )}
          </div>

          <div className="player-stats-inline-row">
            <strong>
              <Arms amount={activePlayer.arms ?? 0} />
            </strong>
            {turnIncome.arms > 0 && (
              <span className="player-stats-turn-income">+{turnIncome.arms}</span>
            )}
          </div>
        </div>

        {(gameState.kingsContracts.some((c) => c.playerId === activePlayer.id) ||
          activePlayer.artifacts.length > 0) && (
          <div className="player-stats-contracts">
            {gameState.kingsContracts
              .filter((c) => c.playerId === activePlayer.id)
              .map((c) => {
                const tile = gameState.tiles[c.tilePosition];
                if (!tile) return null;
                return (
                  <span
                    key={c.tilePosition}
                    className="player-contract-badge"
                    onClick={() =>
                      sayLocal(
                        t('currentPlayer.kingsContractTooltip', {
                          tileName: tile.name,
                          award: c.award,
                        }),
                        'info'
                      )
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="icon">📜</span> {tile.name}
                  </span>
                );
              })}
            {activePlayer.artifacts.map((id) => {
              const artifact = getArtifact(id);
              if (!artifact) return null;
              return (
                <span
                  key={`artifact-${id}`}
                  className={
                    'player-artifact-badge' +
                    (iconOnlyArtifacts ? ' player-artifact-badge--icon-only' : '')
                  }
                  onClick={() =>
                    sayLocal(
                      t('currentPlayer.artifactTooltip', {
                        name: artifact.name,
                        description: artifact.description,
                      }),
                      'info'
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <span className="icon">{artifact.emoji}</span>
                  {!iconOnlyArtifacts && <> {artifact.name}</>}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
