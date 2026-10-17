import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../../game/GameState';
import { Player } from '../../game/Player';
import '../../styles/CurrentPlayer.css';
import { sayLocal } from '../../utils/say';
import { PlayerLabel } from '../snippets/PlayerLabel';
import { playerTurnIncome, playerRawTurnIncome } from '../../game/income';
import { getArtifact } from '../../game/artifacts';
import { SquadDisplay } from '../ui/SquadDisplay';
import { Gold } from '../snippets/Gold';
import { Tower } from '../snippets/Tower';
import { GarrisonsScreen } from '../screens/GarrisonsScreen';
import { gameEvent } from '../../utils/events';
import { showScreen } from '../../utils/screenStore';
import { handleKingCastle } from '../../actions/king';
import { MAX_ARMY_SLOTS } from '../../game/constants';
import { openTavernHireOnly } from '../../actions/tavern';
import { openStablesHireOnly } from '../../actions/stables';
import { useT } from '../../i18n';
import Militia from '../snippets/Militia';
import Fame from '../snippets/Fame';

interface CurrentPlayerProps {
  gameState: GameState;
  updateGameState: (gs: GameState) => void;
}

interface RevealedStats {
  gold: number;
  militia: number;
  riders: number;
}

const REVEAL_ANIM_MS = 600;

/**
 * Gold/army numbers for the stats panel, held at their turn-start (pre-
 * income) value across a turn change and only animated up to the real
 * (post-income) value once the TurnAnnouncement plate has fully faded away
 * (the 'turnAnnouncementGone' event) -- so the numbers don't visibly jump
 * while "PlayerName's turn" is still on screen. A same-turn change (selling
 * a tile, hiring units, ...) updates live with no delay or animation, since
 * there's no announcement covering it.
 */
function useRevealedStats(player: Player): RevealedStats {
  const lastPlayerIdRef = useRef<number | null>(null);
  // Per-player "last revealed" snapshot -- what a player's numbers looked
  // like at the end of their last reveal, i.e. their true turn-start value
  // the next time it's their turn.
  const snapshotsRef = useRef<Map<number, RevealedStats>>(new Map());
  const pendingRef = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);
  const [display, setDisplay] = useState<RevealedStats>({
    gold: player.gold,
    militia: player.militia,
    riders: player.riders,
  });

  // Turn change: freeze the display at the new active player's last-known
  // snapshot (if any) and mark a reveal as pending; a first-ever sighting of
  // a player has nothing to hide, so it just shows their real values.
  useEffect(() => {
    if (lastPlayerIdRef.current === player.id) return;
    lastPlayerIdRef.current = player.id;
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    const snapshot = snapshotsRef.current.get(player.id);
    const real = { gold: player.gold, militia: player.militia, riders: player.riders };
    if (snapshot) {
      setDisplay(snapshot);
      pendingRef.current = true;
    } else {
      setDisplay(real);
      snapshotsRef.current.set(player.id, real);
      pendingRef.current = false;
    }
  }, [player.id]);

  // Same-turn changes track live -- skipped while a turn-start reveal is
  // intentionally being held back (see the effect above, which runs first
  // within the same commit and sets pendingRef before this one checks it).
  useEffect(() => {
    if (pendingRef.current) return;
    const real = { gold: player.gold, militia: player.militia, riders: player.riders };
    setDisplay(real);
    snapshotsRef.current.set(player.id, real);
  }, [player.gold, player.militia, player.riders, player.id]);

  useEffect(() => {
    function onGone(e: Event) {
      const id = (e as CustomEvent).detail as number;
      if (id !== player.id || !pendingRef.current) return;
      pendingRef.current = false;
      const from = snapshotsRef.current.get(player.id) ?? display;
      const to = { gold: player.gold, militia: player.militia, riders: player.riders };
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / REVEAL_ANIM_MS);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setDisplay({
          gold: Math.round(from.gold + (to.gold - from.gold) * eased),
          militia: Math.round(from.militia + (to.militia - from.militia) * eased),
          riders: Math.round(from.riders + (to.riders - from.riders) * eased),
        });
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          snapshotsRef.current.set(player.id, to);
        }
      };

      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener('turnAnnouncementGone', onGone as EventListener);
    return () => window.removeEventListener('turnAnnouncementGone', onGone as EventListener);
  }, [player.id, player.gold, player.militia, player.riders]);

  useEffect(
    () => () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return display;
}

export const CurrentPlayer: React.FC<CurrentPlayerProps> = ({ gameState, updateGameState }) => {
  const t = useT();
  const activePlayer = gameState.activePlayer;

  const handleTileNameClick = () => {
    if (gameState.activeTile.id === 'king-castle') {
      handleKingCastle(gameState, updateGameState);
    } else if (gameState.activeTile.id === 'tavern') {
      openTavernHireOnly(gameState, updateGameState);
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
    activePlayer.remainingCapacity('militia') <= 0;
  // Fame 1 is the lowest army-slot bracket (1 slot) -- a player stuck there
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
  const revealed = useRevealedStats(activePlayer);
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
          onClick={() => sayLocal(t('currentPlayer.fameTooltip'), 'info')}
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
          <PlayerLabel player={activePlayer} />

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
          <div
            className="player-stats-data player-stats-army"
            id="statsArmy"
            onClick={() =>
              showScreen({
                content: React.createElement(GarrisonsScreen, {
                  gameState,
                  player: activePlayer,
                  updateGameState,
                }),
              })
            }
          >
            <div>
              <SquadDisplay
                militia={revealed.militia}
                riders={revealed.riders}
                totalSlots={activePlayer.armySlots}
                maxSlots={MAX_ARMY_SLOTS}
                className="player-stats-army-slots"
              />
            </div>

            {turnIncome.units > 0 && (
              <div className="player-stats-income-row">
                <span className="player-stats-turn-income player-stats-army">
                  <Militia amount={`+${turnIncome.units}`} />
                </span>
              </div>
            )}

            <div className="player-stats-garrison-row">
              <span className="squad-chunk">
                <span className="squad-badge">
                  <Tower amount={`${totalGarrison}🧍`} where="before" />
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
          onClick={() => sayLocal(t('currentPlayer.goldTooltip'), 'info')}
        >
          <div className="player-stats-inline-row">
            <img src="assets/sprites/moneybag.svg" alt="🟡" className="gold-icon" />

            <strong>
              <Gold amount={revealed.gold ?? 0} />
            </strong>
          </div>
          <div className="player-stats-inline-row">
            {turnIncome.gold > 0 && (
              <div className="player-stats-income-row">
                <span className="player-stats-turn-income">
                  +<Gold amount={turnIncome.gold ?? 0} />
                </span>
              </div>
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
