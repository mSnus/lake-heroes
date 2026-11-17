import { Player } from '../game/Player';
import { say, sayInTopic, topicSubject } from './say';
import { t } from '../i18n';

/** `decisionKey` is an i18n key, translated fresh at call time (no React
 * render cycle to subscribe to language changes here, but these are
 * one-shot toasts fired in direct response to a bot action, always reading
 * whatever language is active right now). Shared by BotController's
 * UI-driven bots and every headless decision mirror, so the sim log shows
 * the same "decided to X" line a live game would toast. */
export function announce(
  player: Player,
  decisionKey: string,
  params?: Record<string, string | number>
): void {
  const full = t('botController.decided', { name: player.name, decision: t(decisionKey, params) });
  const tileName = params?.tileName;
  if (typeof tileName === 'string' && topicSubject(player.name) === tileName) {
    const part = t('topics.decided', { decision: t(decisionKey, { ...params, tileName: t('topics.it') }) });
    sayInTopic(part, full, 'info', { actor: player.name, subject: tileName });
    return;
  }

  say(full, 'info');
}
