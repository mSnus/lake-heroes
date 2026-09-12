/**
 * Thin client for the multiplayer state store (see server/README.md).
 *
 * Nothing here throws: a dropped connection during someone else's turn is
 * routine, not exceptional, and must never surface as an unhandled rejection
 * inside a React effect (the pattern utils/useAppVersion.ts already follows).
 * Unlike that one, though, these return a discriminated result rather than
 * null — a 409 means "someone else wrote first", which needs a completely
 * different response from "the network is down", and collapsing both to null
 * would lose that.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'stale'; version: number }
  | { ok: false; kind: 'notfound' }
  | { ok: false; kind: 'network' | 'http'; status?: number; message: string };

export interface SeatCode {
  code: string;
  playerIndex: number;
  color: string;
  name: string;
}

export interface CreatedGame {
  codes: SeatCode[];
  version: number;
}

export interface RemoteState {
  state: string;
  version: number;
  status: 'active' | 'finished';
  playerIndex: number;
  color: string;
  /** Seeds a joiner's cursor at "now", so they don't replay a backlog. */
  lastEvent: number;
}

/** One line of narration, as sent and as received. */
export interface OutboundEvent {
  kind: 'toast' | 'banner';
  level: string;
  message: string;
}

export interface RemoteEvent extends OutboundEvent {
  seq: number;
  seat: number;
  /** games.version when it was written, so a straggler can be dropped once
   * the state it described has been superseded. */
  version: number;
}

export interface RemoteVersion {
  version: number;
  status: 'active' | 'finished';
  lastEvent: number;
  /** Present only when the caller's ?after= cursor is behind. */
  events?: RemoteEvent[];
  /** Lowest seq still retained — a cursor below it has to skip ahead. */
  oldestEvent?: number;
}

/**
 * Where the API lives. In dev this stays '/api' and Vite proxies it to the
 * container; the deploy workflow sets VITE_API_BASE for production. An
 * absolute URL works too, for serving the API from its own subdomain — in
 * which case the server needs matching CORS, since a subdomain is a different
 * origin from the page.
 */
const BASE = (import.meta.env?.VITE_API_BASE ?? '/api').replace(/\/$/, '');

/** Abandon a request rather than let a poll pile up behind a stalled network. */
const TIMEOUT_MS = 10_000;

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });

    if (res.status === 409) {
      const body = await res.json().catch(() => ({}) as { version?: number });
      return { ok: false, kind: 'stale', version: Number(body?.version ?? 0) };
    }

    if (res.status === 404) return { ok: false, kind: 'notfound' };

    if (!res.ok) {
      return { ok: false, kind: 'http', status: res.status, message: `HTTP ${res.status}` };
    }

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, kind: 'network', message };
  } finally {
    clearTimeout(timer);
  }
}

const jsonBody = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Host a game: uploads the opening state and gets one join code per seat. */
export function createGame(state: string): Promise<ApiResult<CreatedGame>> {
  return request<CreatedGame>('/games', jsonBody({ state }));
}

/** Full state plus which seat this code owns. */
export function fetchState(code: string): Promise<ApiResult<RemoteState>> {
  return request<RemoteState>(`/games/${encodeURIComponent(code)}`);
}

/** What the poll loop calls: the counter, plus any narration the caller has
 * not seen yet. One request per tick — a separate events endpoint at this
 * cadence would run several players behind one NAT into the IP-keyed throttle
 * (see server/routes/api.php). Costs a few dozen bytes when nothing happened. */
export function fetchVersion(code: string, after = 0): Promise<ApiResult<RemoteVersion>> {
  return request<RemoteVersion>(`/games/${encodeURIComponent(code)}/version?after=${after}`);
}

/** Ship narration from the player currently on turn. */
export function postEvents(
  code: string,
  events: OutboundEvent[]
): Promise<ApiResult<{ lastEvent: number }>> {
  return request<{ lastEvent: number }>(
    `/games/${encodeURIComponent(code)}/events`,
    jsonBody({ events })
  );
}

/** Hand our finished turn over. `version` is the one we last saw; a mismatch
 * comes back as `stale` rather than overwriting whatever arrived meanwhile. */
export function pushState(
  code: string,
  state: string,
  version: number
): Promise<ApiResult<{ version: number }>> {
  return request<{ version: number }>(`/games/${encodeURIComponent(code)}/state`, {
    ...jsonBody({ state, version }),
    method: 'PUT',
  });
}
