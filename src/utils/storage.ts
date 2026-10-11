import { slotKey } from './saveSlots';

export function saveToStorage<T>(key: string, data: T) {
  localStorage.setItem(slotKey(key), JSON.stringify(data));
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(slotKey(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(slotKey(key));
  } catch {
    // ignore
  }
}
