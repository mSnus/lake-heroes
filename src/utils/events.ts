export function gameEvent(event: string, detail: any = null) {
  if (event !== 'logMessage') {
    console.debug(`✉️ received ${event}`, detail);
  }

  window.dispatchEvent(new CustomEvent(event, { detail: detail }));
}
