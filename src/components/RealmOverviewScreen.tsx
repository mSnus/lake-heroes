import React from 'react';
import { GameState } from '../game/GameState';
import { Tower } from './Tower';
import { Player } from '../game/Player';
import { clearScreen } from '../utils/screenStore';
import { playerScore } from '../game/score';
import { getArtifact } from '../game/artifacts';
import { totalWealth } from '../game/wealth';
import { STARS_TO_WIN } from '../utils/stars';
import { playerTurnIncome } from '../game/income';
import { computeAnnualReward, KingsGraceReward } from '../game/kingsGrace';
import { formatArmy } from '../utils/formatArmy';
import { PlayerLabel } from './PlayerLabel';
import { Gold } from './Gold';
import { useT } from '../i18n';
import '../styles/RealmOverviewScreen.css';

interface RealmOverviewScreenProps {
  gameState: GameState;
}

/** "+N" only when there is actually something coming in -- a permanent
 * "(+0)" on every line is noise. Riders never show one: no tile produces
 * them (see game/income.ts's tileTurnIncome, whose units land on militia). */
const delta = (n: number) => (n > 0 ? <span className="realm-delta">+{n}</span> : null);

/** Emoji alone are unreadable to anyone who hasn't memorised them -- the
 * names ride along as a tooltip. */
const artifactNames = (player: Player) =>
  player.artifacts.map((id) => getArtifact(id)?.name ?? id).join(', ');

/** The grace's unit payout before the army-slot fit clamps it down to
 * whatever room the player actually has (see kingsGrace.ts's
 * fitGraceUnits) -- what they'd get with empty slots, not what they're
 * really about to get. Watching for a full army and freeing room before
 * passing the King is the player's own lookout; this is a forecast, not a
 * promise. */
const hypotheticalUnits = (a: KingsGraceReward) => a.tileUnits + a.graceMilitiaOffered + a.graceRidersOffered;

/** Where a lap's pay comes from, as the row's tooltip -- the same breakdown
 * the player pane used to hide behind a click on its 🏰 figure. The grace is
 * the one source that can pay riders, so it spells out the tiers instead of
 * a single 👬 headcount. */
const annualBreakdown = (t: (k: string, v?: any) => string, a: KingsGraceReward): string => {
  const part = (gold: number, units: number, label: string) => {
    const items = [gold > 0 ? `${gold}🟡` : null, units > 0 ? `${units}👬` : null].filter(Boolean);
    return items.length > 0 ? `${items.join(` ${t('common.and')} `)} ${label}` : null;
  };

  const grace = [
    a.kingsGold > 0 ? `${a.kingsGold}🟡` : null,
    a.graceMilitiaOffered + a.graceRidersOffered > 0
      ? formatArmy(a.graceMilitiaOffered, a.graceRidersOffered)
      : null,
  ].filter(Boolean);

  return [
    grace.length > 0
      ? `${grace.join(` ${t('common.and')} `)} ${
          a.kingsHandicap < 1
            ? t('currentPlayer.asKingsGraceHandicapped', { pct: Math.round(a.kingsHandicap * 100) })
            : t('currentPlayer.asKingsGrace')
        }`
      : null,
    part(a.tileGold, a.tileUnits - a.towerUnits, t('currentPlayer.fromYourTiles')),
    part(0, a.towerUnits, t('currentPlayer.fromYourTowers')),
    part(a.arifactGold, 0, t('currentPlayer.fromPristineDiamond')),
  ]
    .filter(Boolean)
    .join(', ');
};

/**
 * Read-only survey of every player in the realm -- holdings, per-turn income,
 * estate and standing. Opened from the King's Castle tile when the active
 * player isn't standing on it (see BoardCanvas), so it never competes with
 * the Castle's own recruiting screen.
 */
const RealmOverviewScreen: React.FC<RealmOverviewScreenProps> = ({ gameState }) => {
  const t = useT();

  // Strongest first -- the screen leads with the power score, so it reads as
  // a standings table rather than an arbitrary turn-order list.
  const ranked = [...gameState.players].sort(
    (a, b) => playerScore(gameState, b) - playerScore(gameState, a)
  );

  const tilesOf = (player: Player) =>
    gameState.tiles.filter((tile) => tile && tile.owner === player.id);

  return (
    <div className="realm-screen">
      <button onClick={clearScreen} className="realm-close" aria-label={t('common.close')}>
        ✕
      </button>

      <div className="realm-inner">
        {ranked.map((player) => {
          const income = playerTurnIncome(gameState, player);
          const tiles = tilesOf(player);
          const annual = computeAnnualReward(gameState, player);

          return (
            <div key={player.id} className="realm-player">
              <div className="realm-player-name">
                {player.karma < 0 && '🕷️'}
                <PlayerLabel player={player} showImage bold />
              </div>
              {player.artifacts.length > 0 && (
                <div className="realm-artifacts" title={artifactNames(player)}>
                  {player.artifacts.map((id) => getArtifact(id)?.emoji ?? '').join('')}
                </div>
              )}

              <div className="realm-stats">
                <span>{player.fame}🏆</span>
                <span>
                  <Gold amount={player.gold} />
                  {delta(income.gold)}
                </span>
                <span>
                  {player.militia}🧍{delta(income.units)}
                </span>
                <span>{player.riders}🐎</span>
              </div>

              <div className="realm-annual" title={annualBreakdown(t, annual)}>
                <span className="realm-annual-label">🏰 {t('tileCard.perYear')}:</span>
                {annual.totalGold > 0 && (
                  <span>
                    +<Gold amount={annual.totalGold} />
                  </span>
                )}
                {hypotheticalUnits(annual) > 0 && <span>+{hypotheticalUnits(annual)}👬</span>}
                {annual.kingsHandicap < 1 && (
                  <span className="realm-annual-grace">
                    {t('realmOverview.gracePct', { pct: Math.round(annual.kingsHandicap * 100) })}
                  </span>
                )}
              </div>

              {tiles.length > 0 ? (
                <ul className="realm-tiles">
                  {tiles.map((tile) => (
                    <li key={tile.id} className={tile.isYielded ? 'realm-tile yielded' : 'realm-tile'}>
                      <span style={{ color: tile.groupTextColor }}>{tile.name}</span>
                      <span className="realm-tile-meta">
                        <Tower amount={tile.level} where="before" />
                        {tile.garrison > 0 && <> · {tile.garrison}🛡️</>}
                        {tile.isYielded && <> · 👑</>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="realm-no-tiles">{t('realmOverview.noTiles')}</div>
              )}

              <div className="realm-totals">
                <span>{playerScore(gameState, player)}⭐</span>
                <span>{totalWealth(gameState, player)}🧮</span>
                {/* 🌟, not ⭐ -- this is the prisoners-taken win counter (see
                    utils/stars.ts), not the power score just left of it. */}
                <span>
                  {player.stars}/{STARS_TO_WIN}🌟
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RealmOverviewScreen;
