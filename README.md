# Lake Heroes

A browser-based fantasy board game for 2+ players (local pass-and-play, AI
bots, or online). Roll the dice, move around the board, claim and upgrade
land, raise an army of Militia and Riders, and fight your rivals — or the
tile guards, a passing caravan, a rogue horde, or the Dragon itself — for
gold, fame, and ultimately the win.

## What you do

- **Move & claim.** Roll dice around a circular board of ownable tiles
  (Mills, Farms, Fields, Camps, Towers, Traders) — land on an unowned one to
  claim it, or challenge whoever already holds it.
- **Build up.** Upgrade owned tiles through three levels for more income and
  a sturdier garrison; station Militia and Riders to defend them.
- **Fight.** Tile claims, ambushes, caravan raids, rogue hordes, and the
  Dragon all resolve on a tactical hex battle grid, animated or auto-played
  depending on your Settings.
- **Ride your luck.** Special tiles add King's Castle contracts and grace,
  a Sphynx, a Joker with random board-wide events (Taxes, Plague, Rust, and
  more), a Tavern, forks in the road, and more.
- **Win.** Build fame and wealth faster than everyone else to take the
  crown.

## Getting started (development)

```
npm install
npm start      # dev server at http://localhost:3000, hot-reloads on edit
npm run build  # production build to dist/
```

Built with React, TypeScript, and Vite.

## License

This game is distributed under the **[PolyForm Noncommercial License
1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)** — see
[`LICENSE.md`](./LICENSE.md). In short: you're welcome to play it, fork it,
and modify it for noncommercial purposes, but commercial use isn't
permitted without the author's permission.

## Emoji Legend

All emojis used across the game UI, grouped by purpose.

### Resources & stats
| Emoji | Meaning |
|-------|---------|
| 🟡 | Gold |
| 🧍 | Warrior / unit |
| 🧍🏻 | Surviving warrior (battle round) |
| 🏆 | Fame / leadership |
| 👬 | Units bonus (per-year income) |
| 👛 | Purchase cost ("to own") |

### Combat
| Emoji | Meaning |
|-------|---------|
| ⚔️ | Attack / battle |
| 🛡️ | Defence |
| 🎲 | Dice roll |
| 💥 | Warrior lost in a round |
| ☠️ | Battle lost |
| 🏴 | Round tie |
| 🩸 | Casualties |
| 🏹 | Ranged / archers |
| 🗡️ | Sword |
| 💣 / 💥 | Explosion / damage |

### Dragon & outcomes
| Emoji | Meaning |
|-------|---------|
| 🐉 | The Dragon (victory) |
| 🐲 | Dragon (new game) |
| 🌹 | "Send flowers" (owner jailed, free pass) |
| 😢 | Accept loss |
| 🏃 | Flee |

### Special tiles
| Emoji | Meaning |
|-------|---------|
| 🏰 | King's Castle |
| 🪎 | Treasure Box |
| 🍺 | Tavern |
| 🦁 | Sphynx |
| ⛓️ | Prison |
| 🃏 | Joker |
| 🌀 | Portal |
| 🗺️ | Map / discover |

### Tile groups
| Emoji | Meaning |
|-------|---------|
| 🏭 | Mills |
| 🚜 | Farms |
| 🌾 | Fields |
| ⛺ | Camps |
| 🪓 | Traders |
| 🗼 | Towers |
| ⭐ | Special |

### Tile sprites
| Emoji | Meaning |
|-------|---------|
| 💧 | Water mill |
| 🧱 | Brick factory |
| 🐷 | Pigs farm |
| 🐄 | Cows farm |
| 🐑 | Sheep farm |
| 🥬 | Cabbage field |
| 🍎 | Fruit garden |
| 🍇 | Grapes |
| 🐟 | Fish |
| 🦫 | Fur |
| 🐈 | (cat) |
| 🌬️ | Windmill / hurricane |
| 🏘️ | Buildings |

### UI & actions
| Emoji | Meaning |
|-------|---------|
| ⏳ | End turn |
| 📜 | Game log |
| 📋 | Copy / list |
| ⬆️ | Upgrade |
| 🪙 | Sell |
| 💰 | Sell tiles |
| 🔻 | Lacking resource |
| 🔒 | Locked |
| 🚩 | Owned by |
| ✉️ | Message / event |
| ↪️ | Random name |
| ⚜️ | Royal / fleur-de-lis |
| ❌ | Close / unaffordable |
| ✕ | Close |
| ✓ | Current level |
