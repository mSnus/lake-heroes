import { useEffect, useState } from 'react';
import pkg from '../../package.json';

/**
 * Resolves to the deployed build's version (written to version.txt by the
 * deploy workflow), falling back to package.json's version until that fetch
 * resolves (or if it 404s, e.g. when running locally where version.txt is
 * just a placeholder).
 *
 * Uses a relative path — the app is served from a subpath in production
 * (vite.config's `base: './'`), so a leading-slash fetch would hit the
 * domain root instead of the deployed build's own directory and silently
 * 404, leaving the version stuck on the package.json fallback.
 */
export function useAppVersion(): string {
  const [version, setVersion] = useState(pkg.version);

  useEffect(() => {
    resolveAppVersion().then(setVersion);
  }, []);

  return version;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A random 12-letter query-string salt, so the browser (or an intermediate
 * cache/CDN) can't serve a stale version.txt from a previous deploy. */
function randomSalt(): string {
  let salt = '';
  for (let i = 0; i < 12; i++) {
    salt += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }

  return salt;
}

/** Non-hook variant for one-off lookups outside a component, e.g. a toast fired from a mount effect. */
export async function resolveAppVersion(): Promise<string> {
  try {
    const r = await fetch(`version.txt?${randomSalt()}`);
    const text = r.ok ? await r.text() : null;
    return text?.trim() ? text.trim() : pkg.version;
  } catch {
    return pkg.version;
  }
}

/** How often to re-check for a newer deployed version while the tab stays open. */
const VERSION_CHECK_INTERVAL_MS = 2 * 60 * 1000;

export interface VersionMismatch {
  /** This bundle's own baked-in version (VITE_APP_VERSION at build time) --
   * what the code actually running right now was built as, regardless of
   * what any caching layer thinks it served. */
  running: string;
  /** The latest version.txt on the server, fetched fresh with a cache-
   * busting salt -- null until the first check resolves. */
  latest: string | null;
  /** True once `latest` is known and differs from `running`. */
  stale: boolean;
}

/**
 * Direct, objective staleness check that doesn't depend on trusting the
 * service worker's own update machinery: compares the version this bundle
 * was actually BUILT as against a fresh fetch of what the server currently
 * has. If they differ, the code running right now is provably stale,
 * however the SW/cache layer is behaving.
 *
 * Skipped entirely for a local dev/unbuilt-CI run (VITE_APP_VERSION unset)
 * -- there's nothing meaningful to compare against, and version.txt's own
 * package.json fallback would otherwise never match the dev bundle's
 * missing version, showing a permanent false positive.
 */
export function useVersionMismatch(): VersionMismatch {
  const running = import.meta.env.VITE_APP_VERSION;
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    const check = () => {
      resolveAppVersion().then((v) => {
        if (!cancelled) setLatest(v);
      });
    };

    check();
    const id = setInterval(check, VERSION_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [running]);

  return { running: running ?? 'dev', latest, stale: !!running && latest !== null && latest !== running };
}
