import React, { useRef, useEffect } from 'react';
import {
  collection, getDocs, addDoc, writeBatch, doc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { parseIcs, detectDuplicates } from '../utils/icsParser.js';
import NotificationSettings from './NotificationSettings.jsx';
import { useCalendarFeed } from '../hooks/useCalendarFeed.js';

export default function SettingsMenu({
  user, settings, updateSettings, uid,
  onClose, showToast, showConfirm,
  suppressEscapeClose = false
}) {
  const importFileRef = useRef(null);
  const calendarFileRef = useRef(null);
  const { feedUrl, isGenerating, regenerate } = useCalendarFeed(uid);

  useEffect(() => {
    if (suppressEscapeClose) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, suppressEscapeClose]);

  async function handleExport() {
    try {
      const snapshot = await getDocs(collection(db, 'users', uid, 'events'));
      const events = snapshot.docs.map(d => {
        const data = d.data();
        return {
          name: data.name,
          date: data.date,
          time: data.time || '',
          bgColor: data.bgColor || 'yellow-300'
        };
      });
      const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uid}_events.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Events exported successfully!', 'success');
    } catch {
      showToast('Failed to export events.');
    }
  }

  async function handleImportJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const ref = collection(db, 'users', uid, 'events');
      const batch = writeBatch(db);
      imported.forEach(event => {
        const newDoc = doc(ref);
        batch.set(newDoc, {
          name: event.name || 'Unnamed Event',
          date: event.date || new Date().toISOString().slice(0, 10),
          time: event.time || '',
          bgColor: event.bgColor || 'yellow-300',
          owner: uid,
          createdAt: serverTimestamp(),
          timezone: ''
        });
      });
      await batch.commit();
      showToast(`Imported ${imported.length} events.`, 'success');
    } catch {
      showToast('Invalid JSON file or import failed.');
    }
    e.target.value = '';
  }

  async function handleImportIcs(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { events, totalParsed } = parseIcs(text);

      const snapshot = await getDocs(collection(db, 'users', uid, 'events'));
      const existing = snapshot.docs.map(d => d.data());
      const duplicates = detectDuplicates(events, existing);
      const fresh = events.filter(ev =>
        !existing.some(ex => ex.name === ev.name && ex.date === ev.date)
      );

      async function importEvents(toImport) {
        const ref = collection(db, 'users', uid, 'events');
        const batch = writeBatch(db);
        toImport.forEach(event => {
          const newDoc = doc(ref);
          batch.set(newDoc, { name: event.name, date: event.date, time: '', bgColor: 'yellow-300', owner: uid, createdAt: serverTimestamp(), timezone: '' });
        });
        await batch.commit();
        const skipped = totalParsed - events.length;
        let msg = `Imported ${toImport.length} calendar event${toImport.length !== 1 ? 's' : ''}.`;
        if (skipped > 0) msg += ` ${skipped} outside 1-year window skipped.`;
        showToast(msg, toImport.length > 0 ? 'success' : 'error');
      }

      if (events.length === 0 && totalParsed > 0) {
        showToast(`No events imported — all ${totalParsed} were outside the 1-year window.`, 'error');
        return;
      }

      if (duplicates.length > 0) {
        showConfirm(
          `${fresh.length} new event${fresh.length !== 1 ? 's' : ''} will be added. ` +
          `${duplicates.length} already exist (same name + date).\n\nConfirm = import all.  Cancel = skip duplicates.`,
          () => importEvents(events),
          () => importEvents(fresh)
        );
        return;
      }

      await importEvents(events);
    } catch {
      showToast('Invalid ICS file or import failed.');
    }
    e.target.value = '';
  }

  function handleDeleteAll() {
    showConfirm(
      'Are you sure you want to delete ALL events? This cannot be undone.',
      async () => {
        try {
          const snapshot = await getDocs(collection(db, 'users', uid, 'events'));
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          showToast('All events deleted successfully!', 'success');
        } catch {
          showToast('Failed to delete all events.');
        }
      }
    );
  }

  const toggles = [
    { key: 'autoDeleteMode', label: 'Auto-delete past events', desc: 'Remove events automatically after their date passes.' },
    { key: 'showDayOfWeekMode', label: 'Show day of week', desc: 'Include weekdays next to each date in the list.' },
  ];

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal glass modal-scroll"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
          <h2 id="settings-title" className="serif" style={{ fontSize: 22, margin: 0, lineHeight: 1.2 }}>Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">&times;</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 16px', wordBreak: 'break-word' }}>
          {user.email}
        </p>

        <div className="settings-panel">
          {toggles.map(({ key, label, desc }) => (
            <label key={key} className="settings-toggle">
              <div className="settings-toggle-body">
                <div className="settings-toggle-title">{label}</div>
                <div className="settings-toggle-desc">{desc}</div>
              </div>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => updateSettings({ [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>

        <div className="divider" />
        <div className="settings-section-label">Notifications</div>
        <NotificationSettings uid={uid} settings={settings} updateSettings={updateSettings} />

        <div className="divider" />
        <div className="settings-section-label">Default timezone</div>
        <p className="settings-toggle-desc" style={{ margin: '0 0 8px' }}>
          Used when adding events with a time. Detected automatically.
        </p>
        <input
          type="text"
          className="input"
          value={settings.defaultTimezone || ''}
          onChange={e => updateSettings({ defaultTimezone: e.target.value })}
          placeholder="e.g. America/New_York"
          style={{ marginBottom: 4, fontSize: 13 }}
        />
        <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>
          IANA timezone name. Changes apply to new events only.
        </p>

        <div className="divider" />
        <div className="settings-section-label">Calendar feed</div>
        <p className="settings-toggle-desc" style={{ margin: '0 0 8px' }}>
          Subscribe to your events in Google Calendar or Apple Calendar.
        </p>
        {feedUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="input"
                readOnly
                value={feedUrl}
                style={{ fontSize: 11, flex: 1 }}
                onFocus={e => e.target.select()}
              />
              <button
                type="button"
                className="btn"
                style={{ flexShrink: 0 }}
                onClick={() => navigator.clipboard.writeText(feedUrl)}
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, alignSelf: 'flex-start' }}
              onClick={regenerate}
              disabled={isGenerating}
            >
              Regenerate link
            </button>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>
              Sharing this URL gives read access to all your events.
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>Generating…</p>
        )}

        <div className="divider" />

        <div className="settings-section-label">Manage data</div>
        <p className="settings-toggle-desc" style={{ margin: '0 0 12px' }}>
          Export a backup, import JSON or calendar files, or clear every event.
        </p>

        <div className="settings-actions">
          <button type="button" className="btn" onClick={handleExport}>
            Export events (.json)
          </button>
          <button type="button" className="btn" onClick={() => importFileRef.current?.click()}>
            Import events (.json)
          </button>
          <input ref={importFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportJson} />

          <button type="button" className="btn" onClick={() => calendarFileRef.current?.click()}>
            Import calendar (.ics)
          </button>
          <input ref={calendarFileRef} type="file" accept=".ics,text/calendar" style={{ display: 'none' }} onChange={handleImportIcs} />

          <button type="button" className="btn btn-danger" onClick={handleDeleteAll}>
            Delete all events
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Done
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
          v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
