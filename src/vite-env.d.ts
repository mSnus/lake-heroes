/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deploy counter tag (e.g. "0.652"), set by the deploy workflow and
   * baked in at build time -- see registerServiceWorker.ts. Undefined for
   * a local `npm run build`/dev server. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
