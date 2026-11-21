import type { ReactNode } from 'react';
import { notifyLogDrawer } from './logDrawerStore';
import { gameEvent } from './events';
import { getOverrides } from './overridesStore';
import { isHeadlessRun } from './headlessStore';
import { recordSimLog } from './simLogStore';
import { t } from '../i18n';

type ToastContent = ReactNode;

export type SayLevel = 'default' | 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Slide the log drawer down to show a new message, without touching the console mirror or the game-log history.
 *
 * Split out of say() so a turn's messages can be replayed on the OTHER
 * players' screens (see online/useOnlineSync): those arrive with their history
 * already attached, so re-running the logging half would duplicate every line.
 *
 * 'debug' deliberately never toasts — it is per-roll chatter.
 */
export function showToast(_message: ToastContent, level: SayLevel = 'info'): void {
  // The mute override suppresses only the pop-up; say()'s console mirror and
  // game-log event still fire, so nothing is lost.
  if (getOverrides().muteToasts || level === 'debug') return;
  // The message itself reaches the drawer through the game log (see App.tsx).
  notifyLogDrawer();
}

/**
 * say: unified user notification helper.
 * - Slides the log drawer down to show it (unless muted via the ⚖️ overrides)
 * - Logs the same message to the console with an appropriate severity
 * - Dispatches a 'logMessage' event for history tracking
 */
export function say(message: ToastContent, level: SayLevel = 'info'): void {
  // A headless sim plays thousands of turns against its own board -- toasting
  // (or console-mirroring) all of that would flood the real app and slow the
  // run down. Collect the meaningful messages into the per-circle sim log for
  // the results table instead; 'debug' is per-roll chatter, so it's dropped.
  if (isHeadlessRun()) {
    if (level !== 'debug' && typeof message === 'string') recordSimLog(message);
    return;
  }

  showToast(message, level);

  // Console mirror
  const text = typeof message === 'string' ? message : '[toast message]';
  switch (level) {
    case 'warning':
      console.warn(`[toast:${level}] ${text}`);
      break;
    case 'error':
      console.error(`[toast:${level}] ${text}`);
      break;
    case 'success':
      console.log(`[toast:${level}] ${text}`);
      break;
    case 'info':
      console.info(`[toast:${level}] ${text}`);
      break;
    case 'default':
    default:
      console.log(`[toast:${level}] ${text}`);
      break;
  }

  // Dispatch event for history. A headless run never reaches this far.
  if (typeof message === 'string') {
    gameEvent('logMessage', { message, level, timestamp: Date.now() });
  }
}

/**
 * Tell the OTHER players something, without toasting it here.
 *
 * For the parts of a turn the acting player is already watching — their token
 * sliding along the board, their battle animating — where a toast would be
 * noise locally but is the only account anyone else gets. Emits nothing when
 * offline, since there is nobody to tell.
 */
export function narrate(message: string, level: SayLevel = 'info'): void {
  if (isHeadlessRun()) return;
  gameEvent('narrate', { message, level });
}

/**
 * Tell the other players this player's token just stepped onto a new tile,
 * for the live hop-by-hop board animation (see online/stream.ts's listener
 * and online/remoteMoveStore.ts's replay). Piggybacks on the same toast
 * event the server already accepts (kind 'toast', a 'move' level no real
 * toast ever uses) instead of adding a new event kind, so no backend change
 * is needed -- the position travels as the message text, and the mover's
 * seat comes for free from the event row's own seat column.
 */
export function narrateMove(position: number): void {
  if (isHeadlessRun()) return;
  gameEvent('narrateMove', { position });
}

/**
 * say() for something only THIS player should see: a tooltip they clicked, a
 * validation error they hit, a connection problem on their own machine.
 *
 * Identical to say() locally — same toast, same console, same game log — but
 * dispatched under a different event name, so the online streamer (which
 * listens for 'logMessage' and broadcasts what it hears) never picks it up.
 *
 * A separate event rather than a `broadcast: false` field on the payload:
 * LogMessage is persisted to localStorage and shipped inside the turn
 * envelope, so a flag would leak into both. This way "what gets broadcast" is
 * answerable with a grep.
 */
export function sayLocal(message: ToastContent, level: SayLevel = 'info'): void {
  if (isHeadlessRun()) return;
  showToast(message, level);
  if (typeof message === 'string') {
    gameEvent('logMessageLocal', { message, level, timestamp: Date.now() });
  }
}

// ── Topics ──
// A turn spent on one tile (arriving, discovering, claiming, fighting,
// garrisoning) would otherwise toast once per step. Its messages are held as
// short parts and shown as one line when the topic ends: another topic opens,
// the visit is over (loot, garrison, lost battle, peace) or the turn ends.

const LEVEL_RANK: Record<SayLevel, number> = { debug: 0, default: 1, info: 2, success: 3, warning: 4, error: 5 };

interface Topic {
  actor: string;
  subject: string;
  /** Shown as it was when nothing else joins the topic. */
  opening: { message: string; level: SayLevel; narrated: boolean };
  parts: { text: string; level: SayLevel }[];
}

let topic: Topic | null = null;

/** Starts a topic about `actor` at `subject` (e.g. a tile), opened by `message`. */
export function openTopic(actor: string, subject: string, message: string, level: SayLevel, narrated = false): void {
  closeTopic();
  topic = { actor, subject, opening: { message, level, narrated }, parts: [] };
}

/**
 * A message that belongs to the open topic when it is about the same actor
 * (and subject, if given): held as the short `part`. Otherwise `full` is said
 * as usual.
 */
export function sayInTopic(
  part: string,
  full: string,
  level: SayLevel,
  about: { actor: string; subject?: string }
): void {
  if (topic && topic.actor === about.actor && (!about.subject || about.subject === topic.subject)) {
    topic.parts.push({ text: part, level });
    return;
  }

  say(full, level);
}

/** The open topic's subject, when it is about `actor` -- lets a message refer to it as "it". */
export function topicSubject(actor: string): string | null {
  return topic && topic.actor === actor ? topic.subject : null;
}

/** Shows the open topic as one line (or its opening alone) and ends it. */
export function closeTopic(): void {
  const done = topic;
  topic = null;
  if (!done) return;

  const { opening, parts } = done;
  if (!parts.length) {
    say(opening.message, opening.level);
    if (opening.narrated) narrate(opening.message, opening.level);
    return;
  }

  const level = parts.reduce<SayLevel>((top, p) => (LEVEL_RANK[p.level] > LEVEL_RANK[top] ? p.level : top), 'debug');
  const message = t('topics.atTile', {
    playerName: done.actor,
    tileName: done.subject,
    details: parts.map((p) => p.text).join(', '),
  });
  say(message, level);
  // Debug-only groups don't reach the other players through say(), so tell them directly.
  if (level === 'debug') narrate(message, 'info');
}

/** Drops an open topic unshown (a new game started mid-turn). */
export function discardTopic(): void {
  topic = null;
}
