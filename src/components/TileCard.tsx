import React from 'react';
import { Tile } from '../game/Tile';
import groups from '../settings/groups.json';

interface TileCardProps {
  tile: Tile | undefined;
}

const fmtPrice = (gold: number, units: number): string => {
  const hasGold = gold > 0;
  const hasUnits = units > 0;
  if (hasGold && hasUnits) return `${gold} GP + ${units} U`;
  if (hasGold) return `${gold} GP`;
  if (hasUnits) return `${units} U`;
  return '0';
};

const getBonusType = (tile: Tile): 'gold' | 'units' => {
  if (tile.bonusType) return tile.bonusType;
  // Fallback rule
  return tile.group === 'Camps' || tile.group === 'Towers' ? 'units' : 'gold';
};

export const TileCard: React.FC<TileCardProps> = ({ tile }) => {
  if (!tile) return null;

  const groupMeta = (groups as { name: string; icon: string; color: string }[]).find(
    (g) => g.name === tile.group,
  );
  const groupIcon = groupMeta?.icon ?? '';
  const groupColor = groupMeta?.color ?? '#eee';
  const bonusType = getBonusType(tile);

  const priceLvl1 = fmtPrice(tile.priceGold, tile.priceUnits);
  const priceLvl2 = fmtPrice(tile.upgradePrices['2']?.gold ?? 0, tile.upgradePrices['2']?.units ?? 0);
  const priceLvl3 = fmtPrice(tile.upgradePrices['3']?.gold ?? 0, tile.upgradePrices['3']?.units ?? 0);

  const bonus = (lvl: 1 | 2 | 3) => tile.bonuses[String(lvl)] ?? 0;
  const defence = (lvl: 1 | 2 | 3) => tile.defences[String(lvl)] ?? 0;

  return (
    <div
      className="tile-card"
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        background: '#fff',
        fontSize: '12px',
        color: '#444',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          aria-label="Group color"
          title={tile.group}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: groupColor,
            border: '1px solid #999',
          }}
        />
        <strong>
          {groupIcon} {tile.group}: {tile.name}
        </strong>
      </div>

      {tile.isOwnable && (
        <div>
          <div style={{ marginBottom: 8 }}>
            Bonus: {bonusType === 'gold' ? 'Gold' : 'Units'}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 6px' }}>Lvl</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 6px' }}>Price</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 6px' }}>Bonus</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 6px' }}>Defence</th>
              </tr>
              </thead>
              <tbody>
              <tr>
                <td style={{ padding: '4px 6px' }}>1</td>
                <td style={{ padding: '4px 6px' }}>{priceLvl1}</td>
                <td style={{ padding: '4px 6px' }}>
                  {bonus(1)} {bonusType === 'gold' ? 'GP' : 'U'}
                </td>
                <td style={{ padding: '4px 6px' }}>{defence(1)} U</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 6px' }}>2</td>
                <td style={{ padding: '4px 6px' }}>{priceLvl2}</td>
                <td style={{ padding: '4px 6px' }}>
                  {bonus(2)} {bonusType === 'gold' ? 'GP' : 'U'}
                </td>
                <td style={{ padding: '4px 6px' }}>{defence(2)} U</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 6px' }}>3</td>
                <td style={{ padding: '4px 6px' }}>{priceLvl3}</td>
                <td style={{ padding: '4px 6px' }}>
                  {bonus(3)} {bonusType === 'gold' ? 'GP' : 'U'}
                </td>
                <td style={{ padding: '4px 6px' }}>{defence(3)} U</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TileCard;
