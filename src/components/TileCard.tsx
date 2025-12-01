import React from 'react';
import { Tile } from '../game/Tile';
import groups from '../settings/groups.json';
import '../styles/TileCard.css';

const fmtPrice = (gold: number, units: number): string => {
  const hasGold = gold > 0;
  const hasUnits = units > 0;
  if (hasGold && hasUnits) return `${gold} 🟡 ${units} 🧍`;
  if (hasGold) return `${gold} 🟡`;
  if (hasUnits) return `${units} 🧍`;
  return '0';
};

const getBonusType = (tile: Tile): 'gold' | 'units' => {
  if (tile.bonusType) return tile.bonusType;
  // Fallback rule
  return tile.group === 'Camps' || tile.group === 'Towers' ? 'units' : 'gold';
};

export const TileCard: React.FC<{ tile: Tile | undefined }> = ({ tile }) => {
  if (!tile) return null;

  const groupMeta = (groups as { name: string; icon: string; color: string }[]).find(
    (g) => g.name === tile.group
  );
  const groupIcon = groupMeta?.icon ?? '';
  const groupColor = groupMeta?.color ?? '#eee';
  const bonusType = getBonusType(tile);

  const pricelevel1 = fmtPrice(tile.priceGold, tile.priceUnits);
  const pricelevel2 = fmtPrice(
    tile.upgradePrices['2']?.gold ?? 0,
    tile.upgradePrices['2']?.units ?? 0
  );
  const pricelevel3 = fmtPrice(
    tile.upgradePrices['3']?.gold ?? 0,
    tile.upgradePrices['3']?.units ?? 0
  );

  const bonus = (level: 1 | 2 | 3) => tile.bonuses[level] ?? 0;
  const defence = (level: 1 | 2 | 3) => tile.defences[level] ?? 0;

  return (
    <div className="tile-card">
      <div className="tile-card-header" style={{ background: groupColor }}>
        {groupIcon} {tile.group}
      </div>

      <div className="tile-card-title">
        {tile.name} {tile.level > 1 ? `(Level ${tile.level})` : ''}
      </div>

      {tile.isOwnable && (
        <div className="tile-card-body">
          <div className="tile-card-table-wrap">
            <table className="tile-card-table">
              <thead>
                <tr>
                  <th className="tc-th">Price</th>
                  <th className="tc-th">Bonus</th>
                  <th className="tc-th">Defence</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="tc-td">{pricelevel1}</td>
                  <td className="tc-td">
                    +{bonus(1)} {bonusType === 'gold' ? '🟡' : '🧍'}
                  </td>
                  <td className="tc-td">{defence(1)} 🧍</td>
                </tr>
                <tr>
                  <td className="tc-td">{pricelevel2}</td>
                  <td className="tc-td">
                    +{bonus(2)} {bonusType === 'gold' ? '🟡' : '🧍'}
                  </td>
                  <td className="tc-td">{defence(2)} 🧍</td>
                </tr>
                <tr>
                  <td className="tc-td">{pricelevel3}</td>
                  <td className="tc-td">
                    +{bonus(3)} {bonusType === 'gold' ? '🟡' : '🧍'}
                  </td>
                  <td className="tc-td">{defence(3)} 🧍</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!tile.isOwnable && tile.description && (
        <div className="tile-card-description">{tile.description}</div>
      )}
    </div>
  );
};

export default TileCard;
