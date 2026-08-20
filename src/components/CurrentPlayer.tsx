import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import '../styles/CurrentPlayer.css';
import { say } from '../utils/say';
import { PlayerLabel } from './PlayerLabel';
import { computeAnnualReward } from '../game/kingsGrace';
import { playerTurnIncome } from '../game/income';
import { getArtifact } from '../game/artifacts';
import { SquadDisplay } from './SquadDisplay';
import { getOverrides } from '../utils/overridesStore';
import { gameEvent } from '../utils/events';
import { handleKingCastle } from '../actions/king';
import { openTavernHireOnly } from '../actions/tavern';
import { useT } from '../i18n';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  // Same-turn changes track live -- skipped while a turn-start reveal is
  // intentionally being held back (see the effect above, which runs first
  // within the same commit and sets pendingRef before this one checks it).
  useEffect(() => {
    if (pendingRef.current) return;
    const real = { gold: player.gold, militia: player.militia, riders: player.riders };
    setDisplay(real);
    snapshotsRef.current.set(player.id, real);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The active tile's name is always clickable, but King's Castle and the
  // Tavern get their own dialogue back (mirrors clicking the tile itself on
  // the board) instead of the generic read-only tile card.
  const handleTileNameClick = () => {
    if (gameState.activeTile.id === 'king-castle') {
      handleKingCastle(gameState, updateGameState);
    } else if (gameState.activeTile.id === 'tavern') {
      openTavernHireOnly(gameState, updateGameState);
    } else {
      gameEvent('displayTile', gameState.activeTile);
    }
  };

  const { kingsGold, kingsUnits, arifactGold, towerUnits, tileGold, tileUnits } =
    computeAnnualReward(gameState, activePlayer);
  const turnIncome = playerTurnIncome(gameState, activePlayer);
  const ownedTileCount = gameState.tiles.filter(
    (tile) => tile && tile.owner === activePlayer.id && !tile.isYielded
  ).length;
  const revealed = useRevealedStats(activePlayer);

  return (
    <div className="player-pane-wrapper">
      <div className="current-player">
        {/* fame */}
        <div
          className="player-stats-data"
          id="statsFame"
          onClick={() => say(t('currentPlayer.fameTooltip'), 'info')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="player-stats-hint"
            style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
          >
            🏆
          </div>
          <div>
            <strong>{activePlayer.fame ?? 1}</strong>
          </div>
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
                      say(
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
                  className="player-artifact-badge"
                  onClick={() =>
                    say(
                      t('currentPlayer.artifactTooltip', {
                        name: artifact.name,
                        description: artifact.description,
                      }),
                      'info'
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <span className="icon">{artifact.emoji}</span> {artifact.name}
                </span>
              );
            })}
          </div>
        )}
        <div className="player-stats-gold">
          {/* wealth */}
          <div
            className="player-stats-data"
            id="statsOwnedResources"
            onClick={() => say(t('currentPlayer.goldTooltip'), 'info')}
          >
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              👛
            </div>
            <div className="player-stats-inline-row">
              <strong>{revealed.gold ?? 0}🟡</strong>
              {turnIncome.gold > 0 && (
                <span className="player-stats-turn-income">+{turnIncome.gold}🟡</span>
              )}
            </div>
          </div>

          <div
            className="player-stats-data"
            id="statsPerTurn"
            onClick={() => {
              const fmt = (gold: number, units: number, label: string) => {
                const items = [
                  gold > 0 ? `${gold}🟡` : null,
                  units > 0 ? `${units}👬` : null,
                ].filter(Boolean);
                return items.length > 0 ? `${items.join(` ${t('common.and')} `)} ${label}` : null;
              };
              const parts = [
                fmt(kingsGold, kingsUnits, t('currentPlayer.asKingsGrace')),
                fmt(tileGold, tileUnits - towerUnits, t('currentPlayer.fromYourTiles')),
                fmt(0, towerUnits, t('currentPlayer.fromYourTowers')),
                fmt(arifactGold, 0, t('currentPlayer.fromPristineDiamond')),
              ].filter(Boolean);
              say(t('currentPlayer.wagesMessage', { summary: parts.join(', ') }), 'info');
            }}
          >
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              🏰
            </div>
            <div>
              {kingsGold + arifactGold + tileGold > 0 && (
                <strong>+{kingsGold + arifactGold + tileGold}🟡</strong>
              )}
              {kingsUnits + tileUnits > 0 && <strong>+{kingsUnits + tileUnits} 👬</strong>}
            </div>
          </div>
        </div>

        <div className="player-stats-army-row">
          <div
            className="player-stats-data player-stats-army-cell"
            id="statsArmy"
            onClick={() =>
              say(
                t('currentPlayer.armyTooltip', {
                  fame: activePlayer.fame,
                  slots: activePlayer.armySlots,
                  perSlot: getOverrides().armySlotCapacity,
                }),
                'info'
              )
            }
          >
            <div
              className="player-stats-hint"
              style={{ background: (activePlayer?.color ?? '#eeeeee') + 'ff' }}
            >
              ⚔️
            </div>
            <div className="player-stats-inline-row">
              <SquadDisplay
                militia={revealed.militia}
                riders={revealed.riders}
                totalSlots={activePlayer.armySlots}
                className="player-stats-army-slots"
              />
              {turnIncome.units > 0 && (
                <span
                  className="player-stats-turn-income"
                  onClick={(e) => {
                    e.stopPropagation();
                    say(
                      t('currentPlayer.unitsIncomeTooltip', {
                        units: turnIncome.units,
                        tiles: ownedTileCount,
                      }),
                      'info'
                    );
                  }}
                >
                  +{turnIncome.units}🧍
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
