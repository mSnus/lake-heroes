import { useSyncExternalStore } from 'react';

/** 'sim' is a pseudo-language, not a real user-facing choice -- it backs
 * sim.json, switched to only while the economy simulator runs (see
 * EconomySimScreen.tsx), so its tuned message text doesn't have to live in
 * en.json. Deliberately excluded from LANGUAGES below, so it never appears
 * in the language cycle button and loadInitialLanguage's LANGUAGES check
 * rejects it if it's ever somehow still in localStorage on a fresh load. */
export type Language = 'en' | 'ru' | 'es' | 'sim';

export interface LanguageOption {
  code: Language;
  flag: string;
  name: string;
}

// Order here is also the cycle order for the language switcher button.
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
];

const STORAGE_KEY = 'language';

function loadInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved as Language;
  } catch {
    // ignore
  }

  return 'en';
}

let currentLanguage: Language = loadInitialLanguage();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }

  emit();
}

/** Cycles to the next language in LANGUAGES order, wrapping around. */
export function cycleLanguage(): void {
  const idx = LANGUAGES.findIndex((l) => l.code === currentLanguage);
  const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
  setLanguage(next.code);
}

/** Subscribes the calling component to language changes (re-renders on
 * switch) and returns the current language code. */
export function useLanguage(): Language {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentLanguage
  );
}
