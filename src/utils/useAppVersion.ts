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

/** Non-hook variant for one-off lookups outside a component, e.g. a toast fired from a mount effect. */
export async function resolveAppVersion(): Promise<string> {
  try {
    const r = await fetch('version.txt');
    const text = r.ok ? await r.text() : null;
    return text?.trim() ? text.trim() : pkg.version;
  } catch {
    return pkg.version;
  }
}
