import { Player } from '../game/Player';
import { say, sayInTopic, topicSubject } from './say';
import { t } from '../i18n';

// Decisions that only ever come up while visiting the topic's tile.
const TILE_VISIT_DECISIONS = new Set([
  'botController.sellTilesToPayFee',
  'botController.noRevenge',
  'botController.goWithPeace',
  'botController.acceptTheLoss',
  'botController.fight',
  'botController.takeUndefendedTile',
]);

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
  const subject = topicSubject(player.name);
  if (subject && (tileName === subject || TILE_VISIT_DECISIONS.has(decisionKey))) {
    const shortParams = typeof tileName === 'string' ? { ...params, tileName: t('topics.it') } : params;
    sayInTopic(t('topics.decided', { decision: t(decisionKey, shortParams) }), full, 'info', { actor: player.name });
    return;
  }

  say(full, 'info');
}
