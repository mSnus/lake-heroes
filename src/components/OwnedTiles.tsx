import React, { useMemo } from 'react';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { Tile } from '../game/Tile';
import TileCard from './TileCard';
import groups from '../settings/groups.json';
import { syndicateMultiplier } from '../game/syndicate';
import '../styles/OwnedTiles.css';

const groupOrder = (group: string): number => {
  const i = (groups as { name: string }[]).findIndex((g) => g.name === group);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

const basePrice = (tile: Tile): number => tile.prices?.['1']?.gold ?? 0;

interface Props {
  gameState: GameState;
  updateGameState: (gameState: GameState) => void;
}

export const OwnedTiles: React.FC<Props> = ({ gameState, updateGameState }) => {
  if (!gameState) return <div></div>;

  const activePlayer = gameState.activePlayer as Player;

  // Map owned tiles (keeping indices), sort by group then price, then bucket
  // into consecutive groups. A group the player owns in full is a syndicate.
  const grouped = useMemo(() => {
    const res: { tile: Tile; idx: number }[] = [];
    gameState.tiles.forEach((t: any, idx: number) => {
      if (t && t.owner === activePlayer.name) res.push({ tile: t as Tile, idx });
    });
    res.sort((a, b) => {
      const groupDiff = groupOrder(a.tile.group) - groupOrder(b.tile.group);
      if (groupDiff !== 0) return groupDiff;
      return basePrice(a.tile) - basePrice(b.tile);
    });

    const buckets: { group: string; syndicate: boolean; items: { tile: Tile; idx: number }[] }[] =
      [];
    for (const entry of res) {
      const group = entry.tile.group;
      let bucket = buckets[buckets.length - 1];
      if (!bucket || bucket.group !== group) {
        bucket = {
          group,
          syndicate: syndicateMultiplier(gameState, activePlayer, group) > 1,
          items: [],
        };
        buckets.push(bucket);
      }
      bucket.items.push(entry);
    }
    return buckets;
  }, [gameState, activePlayer.name]);

  const isEmpty = grouped.length === 0;

  return (
    <div className="cards-pane-wrapper">
      <div className="owned-cards">
        {isEmpty && <div className="poor-player">Poor {activePlayer.name} owns nothing</div>}

        {grouped.map((bucket) => (
          <div
            key={bucket.group}
            className={'owned-group' + (bucket.syndicate ? ' owned-group-syndicate' : '')}
          >
            {bucket.items.map(({ tile, idx }) => (
              <div key={idx} style={{ position: 'relative' }}>
                <TileCard
                  tile={tile}
                  mode="owned"
                  gameState={gameState}
                  updateGameState={updateGameState}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
