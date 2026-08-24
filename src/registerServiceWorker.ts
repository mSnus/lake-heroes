/**
 * Manual service worker registration -- vite-plugin-pwa's auto-injected
 * registration script is off (see vite.config.ts's injectRegister: false)
 * so this can do two things it can't:
 *
 * 1. Tag the registration URL with the build version (baked in at build
 *    time via VITE_APP_VERSION, set by the deploy workflow). Without this,
 *    a browser (or intermediate cache) that's still holding a stale copy
 *    of sw.js itself from HTTP caching has no reason to ever re-fetch it --
 *    a new deploy's sw.js lives at a genuinely different URL instead.
 * 2. Force a single reload the moment a background update actually takes
 *    over (serviceWorker's controllerchange event), rather than leaving a
 *    player to notice stale content and reload repeatedly until the new
 *    service worker happens to have finished installing.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    // Captured before register() -- a page loading for the very first time
    // (no service worker has ever controlled it yet) will also fire
    // controllerchange once this registration activates, which isn't an
    // update and shouldn't trigger a reload.
    const hadController = !!navigator.serviceWorker.controller;
    const version = import.meta.env.VITE_APP_VERSION || 'dev';

    navigator.serviceWorker
      .register(`./sw.js?v=${version}`, { scope: './' })
      .catch((err) => console.error('Service worker registration failed', err));

    if (!hadController) return;

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
