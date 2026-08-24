/**
 * Unregisters every service worker and empties Cache Storage, then reloads
 * -- forces the next load to fetch everything from the network, the same
 * effect as manually clearing site data (which has been the only thing
 * reliably clearing stale cached code). Does not touch localStorage, so
 * the current game and overrides survive.
 */
export function forceFreshReload(): void {
  Promise.all([
    navigator.serviceWorker
      ?.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister()))) ?? Promise.resolve(),
    typeof caches !== 'undefined'
      ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      : Promise.resolve(),
  ]).finally(() => window.location.reload());
}
