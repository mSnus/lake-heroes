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
    fetch('version.txt')
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (text?.trim()) setVersion(text.trim());
      })
      .catch(() => {});
  }, []);

  return version;
}
