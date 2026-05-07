import React, { useRef, useEffect } from 'react';
import {
  collection, getDocs, addDoc, writeBatch, doc
} from 'firebase/firestore';
import { db } from '../firebase.js';

export default function SettingsMenu({
  user, settings, updateSettings, uid,
  onClose, showToast, showConfirm,
  suppressEscapeClose = false
}) {
  const importFileRef = useRef(null);
  const calendarFileRef = useRef(null);

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
          owner: uid
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
      const lines = text.split(/\r?\n/);
      const events = [];
      let current = {};
      let totalParsed = 0;

      for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
          current = {};
        } else if (line.startsWith('SUMMARY:')) {
          current.name = line.slice(8).trim();
        } else if (line.startsWith('DTSTART;VALUE=DATE:')) {
          const raw = line.split(':')[1].trim();
          current.date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        } else if (line.startsWith('END:VEVENT') && current.name && current.date) {
          totalParsed++;
          const [ey, em, ed] = current.date.split('-').map(Number);
          const eventDate = new Date(ey, em - 1, ed);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yearAhead = new Date();
          yearAhead.setFullYear(today.getFullYear() + 1);
          yearAhead.setHours(23, 59, 59, 999);
          if (eventDate >= today && eventDate <= yearAhead) {
            events.push({ ...current });
          }
        }
      }

      const ref = collection(db, 'users', uid, 'events');
      const batch = writeBatch(db);
      events.forEach(event => {
        const newDoc = doc(ref);
        batch.set(newDoc, {
          name: event.name,
          date: event.date,
          time: '',
          bgColor: 'yellow-300',
          owner: uid
        });
      });
      await batch.commit();

      const skipped = totalParsed - events.length;
      let toastMsg, toastType;
      if (events.length === 0 && totalParsed > 0) {
        toastMsg = `No events imported — all ${totalParsed} events were outside the 1-year lookahead window.`;
        toastType = 'error';
      } else if (skipped > 0) {
        toastMsg = `Imported ${events.length} of ${totalParsed} calendar events. ${skipped} were outside the 1-year window and skipped.`;
        toastType = 'success';
      } else {
        toastMsg = `Imported ${events.length} calendar events.`;
        toastType = 'success';
      }
      showToast(toastMsg, toastType);
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
    { key: 'quickAddMode', label: 'Quick Add Mode', desc: 'Describe events in plain language; AI fills date and time.' },
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
      </div>
    </div>
  );
}
