let inited = false;

/** Lazy-loads and shows Eruda (an in-page mobile devtools panel: console,
 * network, elements, etc) -- only pulled into the bundle once a godmode
 * user actually opens it (see ShieldColumn.tsx). */
export async function openEruda(): Promise<void> {
  const eruda = (await import('eruda')).default;
  if (!inited) {
    eruda.init();
    inited = true;
  }

  eruda.show();
}
