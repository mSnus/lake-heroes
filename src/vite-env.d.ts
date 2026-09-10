/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deploy counter tag (e.g. "0.652"), set by the deploy workflow and
   * baked in at build time -- see registerServiceWorker.ts. Undefined for
   * a local `npm run build`/dev server. */
  readonly VITE_APP_VERSION?: string;
  /** Base path for the multiplayer API. Unset in dev, where Vite proxies
   * /api to the container (see vite.config.ts); set to /heroes/api by the
   * deploy workflow, where the site's nginx proxies it. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
