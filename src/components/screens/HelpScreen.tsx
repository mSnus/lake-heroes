import React from 'react';
import { clearScreen } from '../../utils/screenStore';
import tilesData from '../../settings/tiles.json';
import { Tile, TileJSON } from '../../game/Tile';
import { TileCard } from '../board/TileCard';
import { DecoratedButton } from '../ui/DecoratedButton';
import '../../styles/HelpScreen.css';
import { KNIGHT_FAME } from '../../utils/fame';
import {
  GARRISON_BONUS_SLOTS,
  GARRISON_SLOT_CAPACITY,
  ABSORB_PER_ROLL_POINT,
  ABSORB_BASE,
  FORTIFIED_TILE_GROUPS,
  FLAT_TILE_UNIT_INCOME,
  VISIT_GOLD_MULT,
  VISIT_UNITS_SHARE,
  MILITIA_HP,
  MILITIA_DMG_MIN,
  MILITIA_DMG_MAX,
  RIDER_HP,
  RIDER_DMG_MIN,
  RIDER_DMG_MAX,
  ZOMBIE_HP,
  ZOMBIE_DMG_MIN,
  ZOMBIE_DMG_MAX,
  DRAGON_HP,
  DRAGON_DMG_MIN,
  DRAGON_DMG_MAX,
  MILITIA_ENERGY,
  OTHER_KIND_ENERGY,
  ENERGY_DEPLETED_DAMAGE_MULT,
  BRAWL_THRESHOLD,
} from '../../game/constants';
import { useAppVersion } from '../../utils/useAppVersion';
import { getArtifacts } from '../../game/artifacts';
import { useT } from '../../i18n';

const ownableTileData = (tilesData as TileJSON[]).filter((td) => td.isOwnable);

/** A help-screen list item whose text may contain translated HTML markup
 * (<strong>/<em>/<br/> etc, authored into the locale strings themselves --
 * safe here since these are static, hand-written translations, never user
 * input, matching the same trust model as the rest of the app's htmlMessage
 * screens). */
const HtmlLi: React.FC<{ html: string }> = ({ html }) => (
  <li dangerouslySetInnerHTML={{ __html: html }} />
);

const HelpScreen: React.FC = () => {
  const t = useT();
  const version = useAppVersion();

  // Re-built (and re-sorted) each render so a mid-session language switch
  // re-translates and re-alphabetizes the names immediately.
  const ownableTiles = ownableTileData
    .map((td) => new Tile(td))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [demoIdx, setDemoIdx] = React.useState(() => {
    const i = ownableTiles.findIndex((tl) => tl.id === 'water-mill');
    return i >= 0 ? i : 0;
  });
  const demoTile = ownableTiles[demoIdx] ?? null;
  const garrisonCapacity = (level: number) =>
    (level + GARRISON_BONUS_SLOTS) * GARRISON_SLOT_CAPACITY;
  // Read off a real tile rather than restating the rule, so the help can't
  // drift from Tile.getGarrisonAbsorbBonus. Camps/Towers add one more point
  // on top, quoted separately in the text.
  const plainTile = ownableTiles.find((tl) => !FORTIFIED_TILE_GROUPS.includes(tl.group));
  const absorbPct = (level: number) =>
    Math.round((plainTile?.getGarrisonAbsorbBonus(level) ?? level) * ABSORB_PER_ROLL_POINT * 100);
  const stepDemo = (delta: number) =>
    setDemoIdx((i) => (i + delta + ownableTiles.length) % ownableTiles.length);

  return (
    <div className="help-screen">
      <div className="help-screen-inner">
        <div className="help-screen-header">
          <h2 className="help-screen-title">
            Dragon's Bounty&nbsp;
            <span className="help-screen-version">v.{version}</span>
          </h2>
          <button onClick={clearScreen} className="help-screen-close">
            ✕
          </button>
        </div>

        <div className="help-screen-body">
          <h3>{t('helpScreen.objective.title')}</h3>
          <p dangerouslySetInnerHTML={{ __html: t('helpScreen.objective.body') }} />

          <h3>{t('helpScreen.turnOrder.title')}</h3>
          <ol>
            <HtmlLi html={t('helpScreen.turnOrder.step1')} />
            <HtmlLi html={t('helpScreen.turnOrder.step2')} />
            <HtmlLi html={t('helpScreen.turnOrder.step3')} />
            <HtmlLi html={t('helpScreen.turnOrder.step4')} />
            <HtmlLi html={t('helpScreen.turnOrder.step5')} />
          </ol>

          <h3>{t('helpScreen.goldUnits.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.goldUnits.item1')} />
            <HtmlLi html={t('helpScreen.goldUnits.item2')} />
            <HtmlLi html={t('helpScreen.goldUnits.item3')} />
            <HtmlLi html={t('helpScreen.goldUnits.item4', { knightFame: KNIGHT_FAME })} />
            <HtmlLi html={t('helpScreen.goldUnits.item5')} />
            <HtmlLi
              html={t('helpScreen.goldUnits.item6', { flatUnitIncome: FLAT_TILE_UNIT_INCOME })}
            />
          </ul>

          <h3>{t('helpScreen.fame.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.fame.item1')} />
            <HtmlLi html={t('helpScreen.fame.item2', { knightFame: KNIGHT_FAME })} />
            <li className="help-fame-promotion">
              <img src="assets/figures/footman-red.png" alt="Footman" />
              <span>➡️</span>
              <img src="assets/figures/rider-red.png" alt="Knight" />
            </li>
            <HtmlLi html={t('helpScreen.fame.item3')} />
            <HtmlLi html={t('helpScreen.fame.item4')} />
          </ul>

          <h3>{t('helpScreen.tiles.title')}</h3>
          <ul>
            <li>
              <strong>{t('helpScreen.tiles.discoverTitle')}</strong>{' '}
              {t('helpScreen.tiles.discoverBody')}
              <div className="tile-sprite-container">
                <div className="tile-sprite tile-sprite-unowned"></div>
              </div>
            </li>
            <HtmlLi
              html={t('helpScreen.tiles.own', {
                flatUnitIncome: FLAT_TILE_UNIT_INCOME,
                visitGoldMult: VISIT_GOLD_MULT,
                visitUnitsShare: VISIT_UNITS_SHARE,
              })}
            />
            <HtmlLi html={t('helpScreen.tiles.landingOnOpponent')} />
            <HtmlLi html={t('helpScreen.tiles.syndicates')} />
            <HtmlLi html={t('helpScreen.tiles.sellAnytime')} />
            <HtmlLi html={t('helpScreen.tiles.yieldToKing')} />
            <HtmlLi html={t('helpScreen.tiles.clickToView')} />
          </ul>

          <h3>{t('helpScreen.tileUpgrades.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.tileUpgrades.item1')} />
            <HtmlLi
              html={t('helpScreen.tileUpgrades.item2', {
                slotCapacity: GARRISON_SLOT_CAPACITY,
                level1Capacity: garrisonCapacity(1),
                level2Capacity: garrisonCapacity(2),
                level3Capacity: garrisonCapacity(3),
              })}
            />
            <HtmlLi html={t('helpScreen.tileUpgrades.item3')} />
            <HtmlLi html={t('helpScreen.tileUpgrades.item4')} />
            <HtmlLi
              html={t('helpScreen.tileUpgrades.item5', {
                level1Pct: absorbPct(1),
                level2Pct: absorbPct(2),
                level3Pct: absorbPct(3),
                fortifiedPct: Math.round(ABSORB_PER_ROLL_POINT * 100),
              })}
            />
          </ul>

          {demoTile && (
            <>
              <div className="help-screen-tile-picker">
                <button onClick={() => stepDemo(-1)} aria-label="Previous tile">
                  ◀️
                </button>
                <select
                  value={demoTile.id}
                  onChange={(e) => {
                    const i = ownableTiles.findIndex((tl) => tl.id === e.target.value);
                    if (i >= 0) setDemoIdx(i);
                  }}
                  style={{ background: demoTile.groupColor, color: demoTile.groupTextColor }}
                >
                  {ownableTiles.map((tl) => (
                    <option key={tl.id} value={tl.id}>
                      {tl.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => stepDemo(1)} aria-label="Next tile">
                  ▶️
                </button>
              </div>
              <div className="help-screen-card">
                <TileCard tile={demoTile} mode="display" defaultExpanded demoMode={true} />
              </div>
            </>
          )}

          <h3>{t('helpScreen.specialTiles.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.specialTiles.kingsCastle')} />
            <HtmlLi html={t('helpScreen.specialTiles.treasureChest')} />
            <HtmlLi html={t('helpScreen.specialTiles.tavern')} />
            <HtmlLi html={t('helpScreen.specialTiles.sphynx')} />
            <HtmlLi html={t('helpScreen.specialTiles.prison')} />
            <HtmlLi html={t('helpScreen.specialTiles.joker')} />
            <HtmlLi html={t('helpScreen.specialTiles.ruins')} />
            <HtmlLi html={t('helpScreen.specialTiles.portal')} />
            <HtmlLi html={t('helpScreen.specialTiles.stables')} />
          </ul>

          <h3>{t('helpScreen.travel.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.travel.fork')} />
            <HtmlLi html={t('helpScreen.travel.portal')} />
          </ul>

          <h3>{t('helpScreen.overviewControls.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.overviewControls.kingdom')} />
            <HtmlLi html={t('helpScreen.overviewControls.garrison')} />
            <HtmlLi html={t('helpScreen.overviewControls.player')} />
          </ul>

          <h3>{t('helpScreen.contracts.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.contracts.item1')} />
          </ul>

          <h3>{t('helpScreen.joker.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.joker.intro')} />
            <HtmlLi html={t('helpScreen.joker.taxes')} />
            <HtmlLi html={t('helpScreen.joker.plague')} />
            <HtmlLi html={t('helpScreen.joker.hurricane')} />
            <HtmlLi html={t('helpScreen.joker.blessing')} />
            <HtmlLi html={t('helpScreen.joker.queensGift')} />
            <HtmlLi html={t('helpScreen.joker.earthquake')} />
            <HtmlLi html={t('helpScreen.joker.meteor')} />
            <HtmlLi html={t('helpScreen.joker.kingsGift')} />
            <HtmlLi html={t('helpScreen.joker.rust')} />
          </ul>

          <h3>{t('helpScreen.caravan.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.caravan.item1')} />
            <HtmlLi html={t('helpScreen.caravan.item2')} />
          </ul>

          <h3>{t('helpScreen.dangers.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.dangers.ambush')} />
            <HtmlLi html={t('helpScreen.dangers.rogue')} />
            <HtmlLi html={t('helpScreen.dangers.zombies')} />
          </ul>

          <h3>{t('helpScreen.ruins.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.ruins.item1')} />
            <HtmlLi html={t('helpScreen.ruins.item2')} />
            <HtmlLi html={t('helpScreen.ruins.item3')} />
            <HtmlLi html={t('helpScreen.ruins.item4')} />
          </ul>

          <h3>{t('helpScreen.battle.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.battle.occurs')} />
            <HtmlLi html={t('helpScreen.battle.banzai')} />
            <li>
              <span dangerouslySetInnerHTML={{ __html: t('helpScreen.battle.statsIntro') }} />
              <ul className="help-battle-stats">
                <li>
                  {t('helpScreen.battle.unitStatLine', {
                    icon: '🧍',
                    hp: MILITIA_HP,
                    dmgMin: MILITIA_DMG_MIN,
                    dmgMax: MILITIA_DMG_MAX,
                    energy: MILITIA_ENERGY,
                  })}
                </li>
                <li>
                  {t('helpScreen.battle.unitStatLine', {
                    icon: '🐎',
                    hp: RIDER_HP,
                    dmgMin: RIDER_DMG_MIN,
                    dmgMax: RIDER_DMG_MAX,
                    energy: OTHER_KIND_ENERGY,
                  })}
                </li>
                <li>
                  {t('helpScreen.battle.unitStatLine', {
                    icon: '🧟',
                    hp: ZOMBIE_HP,
                    dmgMin: ZOMBIE_DMG_MIN,
                    dmgMax: ZOMBIE_DMG_MAX,
                    energy: OTHER_KIND_ENERGY,
                  })}
                </li>
                <li>
                  {t('helpScreen.battle.unitStatLine', {
                    icon: '🐉',
                    hp: DRAGON_HP,
                    dmgMin: DRAGON_DMG_MIN,
                    dmgMax: DRAGON_DMG_MAX,
                    energy: OTHER_KIND_ENERGY,
                  })}
                </li>
              </ul>
            </li>
            <HtmlLi
              html={t('helpScreen.battle.absorption', {
                min: Math.round((ABSORB_BASE + ABSORB_PER_ROLL_POINT) * 100),
                max: Math.round((ABSORB_BASE + ABSORB_PER_ROLL_POINT * 6) * 100),
              })}
            />
            <HtmlLi html={t('helpScreen.battle.modifiers')} />
            <HtmlLi
              html={t('helpScreen.battle.energy', {
                pct: Math.round(ENERGY_DEPLETED_DAMAGE_MULT * 100),
              })}
            />
            <HtmlLi html={t('helpScreen.battle.unitsEquivalence')} />
            <HtmlLi html={t('helpScreen.battle.twoModes', { brawlThreshold: BRAWL_THRESHOLD })} />
            <HtmlLi html={t('helpScreen.battle.controls')} />
            <HtmlLi html={t('helpScreen.battle.heroHour')} />
          </ul>

          <h4 className="help-battle-phases-title">{t('helpScreen.battle.phasesTitle')}</h4>
          <table className="help-battle-phases">
            <tbody>
              {(
                [
                  'tactics',
                  'attackDefend',
                  'impact',
                  'outcome',
                  'autoToggle',
                  'undo',
                  'finishTurn',
                  'result',
                ] as const
              ).map((key) => (
                <tr key={key}>
                  <td>{t(`helpScreen.battle.phase.${key}.name`)}</td>
                  <td>{t(`helpScreen.battle.phase.${key}.desc`)}</td>
                  <td>{t(`helpScreen.battle.phase.${key}.icon`)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>{t('helpScreen.artifacts.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.artifacts.intro')} />
            {getArtifacts().map((artifact) => (
              <li key={artifact.id}>
                {artifact.emoji} <strong>{artifact.name}</strong> — {artifact.description}
              </li>
            ))}
          </ul>

          <h3>{t('helpScreen.dragon.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.dragon.item1')} />
            <HtmlLi html={t('helpScreen.dragon.item2')} />
          </ul>

          <h3>{t('helpScreen.copyrights.title')}</h3>
          <ul>
            <li>(c) 2026 Mike Vinetsky, <a href={'https://github.com/mSnus/lake-heroes'}>GitHub</a></li>
            <HtmlLi html={t('helpScreen.copyrights.item1')} />
            <HtmlLi html={t('helpScreen.copyrights.item2')} />
            <HtmlLi html={t('helpScreen.copyrights.item3')} />
            <HtmlLi html={t('helpScreen.copyrights.item4')} />
          </ul>

          <div className="help-screen-continue">
            <DecoratedButton onClick={clearScreen}>{t('common.continue')}</DecoratedButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpScreen;
