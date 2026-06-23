import { KNIGHT_FAME } from './constants';

export interface PlayerOption {
  colorName: string;
  color: string;
  lightColor: string;
  image: string;
}

// lightColor = color lightened by 10 points of HSL lightness (clamped at 100%).
export const playerOptions: PlayerOption[] = [
  { colorName: 'Red', color: '#FF4444', lightColor: '#FF7777', image: 'red' },
  { colorName: 'Blue', color: '#286cff', lightColor: '#5B8FFF', image: 'blue' },
  { colorName: 'Yellow', color: '#FFD700', lightColor: '#FFDF33', image: 'yellow' },
  { colorName: 'Green', color: '#00C851', lightColor: '#00FB66', image: 'green' },
  { colorName: 'Violet', color: '#9933CC', lightColor: '#AD5CD6', image: 'violet' },
  { colorName: 'Black', color: '#5a5a5a', lightColor: '#adadad', image: 'black' },
];

// Blue has no footman sprite — always uses rider
export function getPlayerImageSrc(colorKey: string, fame: number): string {
  // Normalize legacy saved values (e.g. 'rider-blue.png') down to the bare color key.
  const color = colorKey.replace(/\.png$/, '').replace(/^(rider|footman)-/, '');
  const type = fame >= KNIGHT_FAME ? 'rider' : 'footman';
  return `assets/figures/${type}-${color}.png`;
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
  'Happy',
  'Drooling',
  'Eyesore',
  'Coward',
  'Mystic'
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
  'Dwarf',
  'Baron',
  'Lady',
  'Prince',
  'Princess',
  'Bandit',
  'Assassin',
  'Clown',
  'Lady',
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
