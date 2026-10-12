import React, { useRef, useState } from 'react';
import { clearScreen } from '../utils/screenStore';
import {
  SLOT_STORAGE_BASES,
  SlotSummary,
  listSlots,
  switchToSlot,
  clearSlotStorage,
  getActiveSlot,
  keyForSlot,
} from '../utils/saveSlots';
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

/** On-disk shape of a downloaded backup -- one raw (already-JSON-stringified)
 * value per storage base the slot actually had, so restoring is a literal
 * localStorage.setItem per base rather than re-serializing anything. */
interface SlotBackup {
  schema: 1;
  bases: Partial<Record<(typeof SLOT_STORAGE_BASES)[number], string>>;
}

const SaveSlotsScreen: React.FC = () => {
  const t = useT();
  const [slots, setSlots] = useState<SlotSummary[]>(() => listSlots());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlot = getActiveSlot();

  const refresh = () => setSlots(listSlots());

  /** Downloads the active slot's raw storage as one JSON file -- a backup
   * of whatever's actually there (a local game, an online bookmark, or
   * nothing), restorable later via handleFileSelected below, even into a
   * different slot or a different device entirely. */
  const handleDownload = () => {
    const backup: SlotBackup = { schema: 1, bases: {} };
    for (const base of SLOT_STORAGE_BASES) {
      const raw = localStorage.getItem(keyForSlot(activeSlot, base));
      if (raw !== null) backup.bases[base] = raw;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lake-heroes-slot${activeSlot}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Restores a previously downloaded backup into the active slot, replacing
   * whatever is there now -- every base the backup doesn't mention is
   * removed too, so this is a full swap, not a merge. */
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let backup: SlotBackup;
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || parsed.schema !== 1 || typeof parsed.bases !== 'object') {
          throw new Error('not a backup');
        }

        backup = parsed as SlotBackup;
      } catch {
        window.alert(t('saveSlots.invalidBackup'));
        return;
      }

      if (!window.confirm(t('saveSlots.confirmRestore', { slot: activeSlot }))) return;

      for (const base of SLOT_STORAGE_BASES) {
        const value = backup.bases[base];
        if (typeof value === 'string') localStorage.setItem(keyForSlot(activeSlot, base), value);
        else localStorage.removeItem(keyForSlot(activeSlot, base));
      }

      window.location.reload();
    };

    reader.readAsText(file);
  };

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
          <h2 className="save-slots-screen-title">💾 {t('saveSlots.title')}</h2>
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

        <div className="save-slots-backup">
          <p className="save-slots-backup-hint">{t('saveSlots.backupHint', { slot: activeSlot })}</p>
          <div className="save-slots-backup-actions">
            <button className="save-slot-button" onClick={handleDownload}>
              💾 {t('saveSlots.downloadBackup')}
            </button>
            <button className="save-slot-button" onClick={() => fileInputRef.current?.click()}>
              📂 {t('saveSlots.uploadBackup')}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
        </div>
      </div>
    </div>
  );
};

export default SaveSlotsScreen;
