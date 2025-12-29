export function gameEvent(event: string, detail: any = null){
    window.dispatchEvent(new CustomEvent(event, { detail: detail }));
}
