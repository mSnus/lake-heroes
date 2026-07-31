import { tRaw } from '../i18n';

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
export function getPlayerImageSrc(colorKey: string, isKnight: boolean): string {
  // Normalize legacy saved values (e.g. 'rider-blue.png') down to the bare color key.
  const color = colorKey.replace(/\.png$/, '').replace(/^(rider|footman)-/, '');
  const type = isKnight || color === 'blue' ? 'rider' : 'footman';
  return `assets/figures/${type}-${color}.png`;
}

type Gender = 'm' | 'f';
interface NameNoun {
  word: string;
  gender: Gender;
}

/** Russian adjectives must agree in grammatical gender with the noun they
 * modify (e.g. "Пьяный Крестьянин" vs "Пьяная Дама") — English doesn't
 * inflect, so its `pronouns.m`/`pronouns.f` locale lists are just the same
 * words duplicated under both genders. */
function getNouns(): NameNoun[] {
  return tRaw('playerNames.nouns') as NameNoun[];
}

function getPronouns(gender: Gender): string[] {
  return tRaw(`playerNames.pronouns.${gender}`) as string[];
}

export function generatePlayerName(usedNames: string[] = []): string {
  const usedPronouns = new Set(usedNames.map((n) => n.split(' ')[0]));
  const usedNouns = new Set(usedNames.map((n) => n.split(' ')[1]));

  const nouns = getNouns();
  const availableNouns = nouns.filter((n) => !usedNouns.has(n.word));
  const nounPool = availableNouns.length > 0 ? availableNouns : nouns;
  const noun = nounPool[Math.floor(Math.random() * nounPool.length)];

  const pronouns = getPronouns(noun.gender);
  const availablePronouns = pronouns.filter((p) => !usedPronouns.has(p));
  const pronounPool = availablePronouns.length > 0 ? availablePronouns : pronouns;
  const pronoun = pronounPool[Math.floor(Math.random() * pronounPool.length)];

  return `${pronoun} ${noun.word}`;
}
