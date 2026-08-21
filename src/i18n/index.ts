import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import { getLanguage, useLanguage, Language } from './languageStore';

export { LANGUAGES, getLanguage, setLanguage, cycleLanguage, useLanguage } from './languageStore';
export type { Language, LanguageOption } from './languageStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOCALES: Record<Language, any> = { en, ru, es };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookup(locale: any, key: string): unknown {
  return key
    .split('.')
    .reduce((obj, part) => (obj && typeof obj === 'object' ? obj[part] : undefined), locale);
}

/** Raw lookup (string, array, object -- whatever the key holds), falling
 * back to English if the active locale is missing it. Used for non-string
 * data like word lists (playerNames) or arrays of help-screen bullets. */
export function tRaw(key: string): unknown {
  const value = lookup(LOCALES[getLanguage()], key);
  if (value !== undefined) return value;
  return lookup(LOCALES.en, key);
}

/** Like `t`, but returns undefined instead of a fallback string when the key
 * genuinely doesn't exist in either locale — for fields that are legitimately
 * absent on some entries (e.g. only some tiles have a description), where a
 * truthy "tiles.foo.description" placeholder string would be worse than
 * nothing. */
export function tOptional(key: string, params?: Record<string, string | number>): string | undefined {
  let value = lookup(LOCALES[getLanguage()], key);
  if (typeof value !== 'string') value = lookup(LOCALES.en, key);
  if (typeof value !== 'string') return undefined;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined ? String(params[name]) : match
  );
}

/**
 * Translate a string key, with optional `{placeholder}` interpolation.
 * Falls back to English, then to the raw key itself, so a missing
 * translation degrades to visible-but-obviously-wrong rather than a blank
 * or a thrown error.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const value = tOptional(key, params);
  if (value === undefined) {
    //console.warn(`Missing i18n key: ${key}`);
    return key;
  }
  return value;
}

/** For use inside components: subscribes to language changes (so the
 * component re-renders on switch) and returns the `t` function. */
export function useT(): typeof t {
  useLanguage();
  return t;
}
