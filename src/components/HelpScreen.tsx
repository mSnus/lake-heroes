import React from 'react';
import { clearScreen } from '../utils/screenStore';
import tilesData from '../settings/tiles.json';
import { Tile, TileJSON } from '../game/Tile';
import { TileCard } from './TileCard';
import { DecoratedButton } from './DecoratedButton';
import '../styles/HelpScreen.css';
import { KNIGHT_FAME } from '../utils/fame';
import { useAppVersion } from '../utils/useAppVersion';
import { getArtifacts } from '../game/artifacts';
import { useT } from '../i18n';

const waterMillData = (tilesData as TileJSON[]).find((t) => t.id === 'water-mill');
const waterMillTile = waterMillData ? new Tile(waterMillData) : null;

/** A help-screen list item whose text may contain translated HTML markup
 * (<strong>/<em>/<br/> etc, authored into the locale strings themselves --
 * safe here since these are static, hand-written translations, never user
 * input, matching the same trust model as the rest of the app's htmlMessage
 * screens). */
const HtmlLi: React.FC<{ html: string }> = ({ html }) => <li dangerouslySetInnerHTML={{ __html: html }} />;

const HelpScreen: React.FC = () => {
  const t = useT();
  const version = useAppVersion();

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
            <HtmlLi html={t('helpScreen.goldUnits.item6')} />
          </ul>

          <h3>{t('helpScreen.fame.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.fame.item1')} />
            <HtmlLi html={t('helpScreen.fame.item2', { knightFame: KNIGHT_FAME })} />
            <HtmlLi html={t('helpScreen.fame.item3')} />
          </ul>

          <h3>{t('helpScreen.tiles.title')}</h3>
          <ul>
            <li>
              <strong>{t('helpScreen.tiles.discoverTitle')}</strong> {t('helpScreen.tiles.discoverBody')}
              <div className="tile-sprite-container">
                <div className="tile-sprite tile-sprite-unowned"></div>
              </div>
            </li>
            <HtmlLi html={t('helpScreen.tiles.own')} />
            <HtmlLi html={t('helpScreen.tiles.landingOnOpponent')} />
            <HtmlLi html={t('helpScreen.tiles.syndicates')} />
            <HtmlLi html={t('helpScreen.tiles.sellAnytime')} />
            <HtmlLi html={t('helpScreen.tiles.yieldToKing')} />
            <HtmlLi html={t('helpScreen.tiles.clickToView')} />
          </ul>

          <h3>{t('helpScreen.tileUpgrades.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.tileUpgrades.item1')} />
            <HtmlLi html={t('helpScreen.tileUpgrades.item2')} />
            <HtmlLi html={t('helpScreen.tileUpgrades.item3')} />
          </ul>

          {waterMillTile && (
            <div className="help-screen-card">
              <TileCard tile={waterMillTile} mode="display" defaultExpanded demoMode={true} />
            </div>
          )}

          <h3>{t('helpScreen.specialTiles.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.specialTiles.kingsCastle')} />
            <HtmlLi html={t('helpScreen.specialTiles.treasureChest')} />
            <HtmlLi html={t('helpScreen.specialTiles.tavern')} />
            <HtmlLi html={t('helpScreen.specialTiles.sphynx')} />
            <HtmlLi html={t('helpScreen.specialTiles.prison')} />
            <HtmlLi html={t('helpScreen.specialTiles.joker')} />
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
          </ul>

          <h3>{t('helpScreen.caravan.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.caravan.item1')} />
            <HtmlLi html={t('helpScreen.caravan.item2')} />
          </ul>

          <h3>{t('helpScreen.battle.title')}</h3>
          <ul>
            <HtmlLi html={t('helpScreen.battle.squad')} />
            <HtmlLi html={t('helpScreen.battle.razing')} />
            <HtmlLi html={t('helpScreen.battle.twoModes')} />
            <HtmlLi html={t('helpScreen.battle.brawlMode')} />
            <HtmlLi html={t('helpScreen.battle.normalMode')} />
            <HtmlLi html={t('helpScreen.battle.tie')} />
            <HtmlLi html={t('helpScreen.battle.priceOfVictory')} />
          </ul>

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

          <div className="help-screen-continue">
            <DecoratedButton onClick={clearScreen}>{t('common.continue')}</DecoratedButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpScreen;
