export interface PlayerOption {
  colorName: string;
  color: string;
  image: string;
}

export const playerOptions: PlayerOption[] = [
  { colorName: 'Red', color: '#FF4444', image: 'rider-red.png' },
  { colorName: 'Blue', color: '#286cff', image: 'rider-blue.png' },
  { colorName: 'Yellow', color: '#FFD700', image: 'rider-yellow.png' },
  { colorName: 'Green', color: '#00C851', image: 'rider-green.png' },
  { colorName: 'Violet', color: '#9933CC', image: 'rider-violet.png' },
  { colorName: 'Black', color: '#212121', image: 'rider-black.png' },
];

export const playerImageAssets: Record<string, string> = playerOptions.reduce(
  (acc, option) => {
    acc[option.image] = `assets/${option.image}`;
    return acc;
  },
  {} as Record<string, string>
);

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
