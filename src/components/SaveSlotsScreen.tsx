import React, { useState } from 'react';
import { clearScreen } from '../utils/screenStore';
import { SLOT_COUNT, SlotSummary, listSlots, switchToSlot, clearSlotStorage, getActiveSlot } from '../utils/saveSlots';
import { halt } from '../utils/haltStore';
import { resetFogTransition } from '../utils/transitionStore';
import { resetOverrides } from '../utils/overridesStore';
import { clearOnlineSession } from '../online/onlineStore';
import { resetLiveFeed } from '../online/liveFeedStore';
import { resetRemoteMove } from '../online/remoteMoveStore';
import { t as translate, useT } from '../i18n';
import '../styles/SaveSlotsScreen.css';

/** Describes a slot's contents on one line, for the row the player picks a
 * slot from -- not a full game summary, just enough to tell slots apart. */
function describeSlot(summary: SlotSummary, t: typeof translate): string {
  if (summary.kind === 'empty') return t('saveSlots.empty');
  if (summary.kind === 'online') {
    return t('saveSlots.onlineSummary', {
      code: summary.code ?? '?',
      status: t(summary.status === 'finished' ? 'saveSlots.statusFinished' : 'saveSlots.statusActive'),
    });
  }

  const players = summary.playerNames?.length ? summary.playerNames.join(', ') : t('saveSlots.unknownPlayers');
  return summary.gameOver
    ? t('saveSlots.localSummaryOver', { players })
    : t('saveSlots.localSummary', { players, turn: summary.turn ?? 0 });
}

const SaveSlotsScreen: React.FC = () => {
  const t = useT();
  const [slots, setSlots] = useState<SlotSummary[]>(() => listSlots());

  const refresh = () => setSlots(listSlots());

  /** Full teardown of the currently active slot's game -- same steps the
   * 🏆 New Game button runs (see ShieldColumn.tsx), just against the active
   * slot's keys specifically and without starting a new one in its place. */
  const deleteActiveSlot = () => {
    halt();
    resetFogTransition();
    clearSlotStorage(getActiveSlot());
    resetOverrides();
    clearOnlineSession();
    resetLiveFeed();
    resetRemoteMove();
    window.location.reload();
  };

  const handleDelete = (summary: SlotSummary) => {
    if (!window.confirm(t('saveSlots.confirmDelete', { slot: summary.slot }))) return;
    if (summary.active) {
      deleteActiveSlot();
      return;
    }

    clearSlotStorage(summary.slot);
    refresh();
  };

  return (
    <div className="save-slots-screen">
      <div className="save-slots-screen-inner">
        <div className="save-slots-screen-header">
          <h2 className="save-slots-screen-title">🛡️ {t('saveSlots.title')}</h2>
          <button onClick={clearScreen} className="save-slots-screen-close">
            ✕
          </button>
        </div>

        <p className="save-slots-screen-hint">{t('saveSlots.hint')}</p>

        <div className="save-slots-list">
          {slots.map((summary) => (
            <div
              key={summary.slot}
              className={`save-slot-row${summary.active ? ' save-slot-active' : ''}`}
            >
              <div className="save-slot-info">
                <span className="save-slot-number">
                  {t('saveSlots.slotLabel', { slot: summary.slot })}
                  {summary.active && <span className="save-slot-badge">{t('saveSlots.activeBadge')}</span>}
                </span>
                <span className="save-slot-summary">{describeSlot(summary, t)}</span>
              </div>

              <div className="save-slot-actions">
                {!summary.active && (
                  <button className="save-slot-button" onClick={() => switchToSlot(summary.slot)}>
                    {summary.kind === 'empty' ? t('saveSlots.switchEmpty') : t('saveSlots.switch')}
                  </button>
                )}
                {summary.kind !== 'empty' && (
                  <button className="save-slot-button save-slot-delete" onClick={() => handleDelete(summary)}>
                    {t('saveSlots.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="save-slots-screen-footnote">{t('saveSlots.slotCountNote', { count: SLOT_COUNT })}</p>
      </div>
    </div>
  );
};

export default SaveSlotsScreen;
