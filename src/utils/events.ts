export function gameEvent(event: string, detail: any = null) {
  if (!['displayTile', 'logMessage'].includes(event)) {
    console.debug(`✉️ received ${event}`, detail);
  }

  window.dispatchEvent(new CustomEvent(event, { detail: detail }));
}
