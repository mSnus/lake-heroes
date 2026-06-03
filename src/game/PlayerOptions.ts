export interface PlayerOption {
  colorName: string;
  color: string;
  image: string;
}

export const playerOptions: PlayerOption[] = [
  { colorName: 'Red', color: '#FF4444', image: 'red' },
  { colorName: 'Blue', color: '#286cff', image: 'blue' },
  { colorName: 'Yellow', color: '#FFD700', image: 'yellow' },
  { colorName: 'Green', color: '#00C851', image: 'green' },
  { colorName: 'Violet', color: '#9933CC', image: 'violet' },
  { colorName: 'Black', color: '#212121', image: 'black' },
];

// Blue has no footman sprite — always uses rider
export function getPlayerImageSrc(colorKey: string, fame: number): string {
  const type = fame >= 4 || colorKey === 'blue' ? 'rider' : 'footman';
  return `assets/figures/${type}-${colorKey}.png`;
}

const pronouns = [
  'Drunken',
  'Laughing',
  'Singing',
  'Angry',
  'Sleepy',
  'Filthy',
  'Pathetic',
  'Toothless',
  'Brave',
  'Ragged',
  'Dirty',
  'Shiny',
  'Merciless',
  'Golden',
  'Radiant',
  'Noble',
  'Valiant',
  'Squint-eyed',
];

const nouns = [
  'Peasant',
  'Gravedigger',
  'Knight',
  'Squire',
  'Raider',
  'Champion',
  'Monk',
  'Nun',
  'Baron',
  'Lady',
  'Prince',
  'Princess',
  'Bandit',
  'Assassin',
];

export function generatePlayerName(usedNames: string[] = []): string {
  const usedPronouns = new Set(usedNames.map((n) => n.split(' ')[0]));
  const usedNouns = new Set(usedNames.map((n) => n.split(' ')[1]));

  const availablePronouns = pronouns.filter((p) => !usedPronouns.has(p));
  const availableNouns = nouns.filter((n) => !usedNouns.has(n));

  const pronounPool = availablePronouns.length > 0 ? availablePronouns : pronouns;
  const nounPool = availableNouns.length > 0 ? availableNouns : nouns;

  const pronoun = pronounPool[Math.floor(Math.random() * pronounPool.length)];
  const noun = nounPool[Math.floor(Math.random() * nounPool.length)];
  return `${pronoun} ${noun}`;
}
