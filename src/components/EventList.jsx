import React, { useCallback, useEffect, useState } from 'react';
import {
  collection, onSnapshot, doc, deleteDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { calculateDaysLeft, getEffectiveDate } from '../utils/dates.js';
import EventItem from './EventItem.jsx';

const SECTION_LABEL = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 10,
  marginTop: 4,
};

const DIVIDER = {
  flex: 1,
  height: 1,
  background: 'var(--line)',
};

function SectionHeader({ label }) {
  return (
    <div style={SECTION_LABEL}>
      <span>{label}</span>
      <span style={DIVIDER} />
    </div>
  );
}

function applySort(list, order) {
  const sorted = [...list];
  switch (order) {
    case 'latest':
      return sorted.sort((a, b) => calculateDaysLeft(getEffectiveDate(b)) - calculateDaysLeft(getEffectiveDate(a)));
    case 'az':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'za':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return sorted.sort((a, b) => calculateDaysLeft(getEffectiveDate(a)) - calculateDaysLeft(getEffectiveDate(b)));
  }
}

export default function EventList({
  uid, settings, showToast, showConfirm, onEventsChange,
  calendarHighlightDate = null
}) {
  const [events, setEvents] = useState([]);
  const [colorMenu, setColorMenu] = useState(null);
  const closeColorPicker = useCallback(() => setColorMenu(null), []);

  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('soonest');
  const [pastOpen, setPastOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (colorMenu && !events.some((e) => e.id === colorMenu.eventId)) {
      setColorMenu(null);
    }
  }, [events, colorMenu]);

  useEffect(() => {
    if (!calendarHighlightDate || events.length === 0) return;
    const match = events.find((e) => e.date === calendarHighlightDate);
    if (!match) return;
    const id = `event-row-${match.id}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [calendarHighlightDate, events]);

  useEffect(() => {
    if (!uid) return;
    const eventsRef = collection(db, 'users', uid, 'events');
    const unsub = onSnapshot(eventsRef, async (snapshot) => {
      let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      if (settings.autoDeleteMode) {
        const batch = writeBatch(db);
        const kept = [];
        docs.forEach(event => {
          if (calculateDaysLeft(event.date) < 0 && !event.recurrence) {
            batch.delete(doc(db, 'users', uid, 'events', event.id));
          } else {
            kept.push(event);
          }
        });
        await batch.commit();
        docs = kept;
      }

      docs.sort((a, b) => calculateDaysLeft(getEffectiveDate(a)) - calculateDaysLeft(getEffectiveDate(b)));
      setEvents(docs);
      if (onEventsChange) onEventsChange(docs);
    });
    return unsub;
  }, [uid, settings.autoDeleteMode]);

  async function handleDelete(event, skipConfirm = false) {
    const doDelete = async () => {
      try {
        await deleteDoc(doc(db, 'users', uid, 'events', event.id));
        showToast(`"${event.name}" deleted.`, 'success');
      } catch {
        showToast(`Failed to delete event "${event.name}".`);
      }
    };

    if (skipConfirm) {
      await doDelete();
    } else {
      showConfirm(
        `Delete "${event.name}"? This cannot be undone.`,
        doDelete
      );
    }
  }

  async function handleColorSelect(eventId, color) {
    try {
      await updateDoc(doc(db, 'users', uid, 'events', eventId), { bgColor: color });
    } catch {
      showToast('Failed to update color.');
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const count = selected.size;
    showConfirm(
      `Delete ${count} event${count !== 1 ? 's' : ''}? This cannot be undone.`,
      async () => {
        try {
          const batch = writeBatch(db);
          selected.forEach(id => {
            batch.delete(doc(db, 'users', uid, 'events', id));
          });
          await batch.commit();
          setSelected(new Set());
          showToast(`Deleted ${count} event${count !== 1 ? 's' : ''}.`, 'success');
        } catch {
          showToast('Failed to delete events.');
        }
      }
    );
  }

  function renderEventRow(event) {
    return (
      <div key={event.id} style={{ position: 'relative' }}>
        {bulkMode && (
          <input
            type="checkbox"
            checked={selected.has(event.id)}
            onChange={() => toggleSelect(event.id)}
            style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, width: 18, height: 18, cursor: 'pointer' }}
          />
        )}
        <EventItem
          id={`event-row-${event.id}`}
          event={event}
          uid={uid}
          showDayOfWeek={settings.showDayOfWeekMode}
          onDelete={handleDelete}
          onColorChange={handleColorSelect}
          showToast={showToast}
          highlighted={calendarHighlightDate != null && event.date === calendarHighlightDate}
          colorPicker={
            colorMenu?.eventId === event.id
              ? { x: colorMenu.x, y: colorMenu.y }
              : null
          }
          onOpenColorPicker={(pid, x, y) => setColorMenu({ eventId: pid, x, y })}
          onCloseColorPicker={closeColorPicker}
        />
      </div>
    );
  }

  const searchActive = search.trim().length > 0;
  const filtered = searchActive
    ? events.filter(e => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : events;

  const upcoming = filtered.filter(e => calculateDaysLeft(getEffectiveDate(e)) >= 0);
  const past = filtered.filter(e => calculateDaysLeft(getEffectiveDate(e)) < 0);

  const sortedUpcoming = applySort(upcoming, sortOrder);
  const sortedPast = applySort(past, sortOrder);
  const sortedFiltered = applySort(filtered, sortOrder);

  const hasEvents = events.length > 0;
  const hasResults = filtered.length > 0;

  if (!hasEvents) {
    return (
      <div className="empty">
        <p style={{ fontSize: 18, marginBottom: 8 }}>No events yet.</p>
        <p style={{ fontSize: 14 }}>Use the bar below to add your first event.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="search"
          className="input"
          placeholder="Search events…"
          style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input"
          style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
        >
          <option value="soonest">Soonest first</option>
          <option value="latest">Latest first</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
        <button
          className={bulkMode ? 'btn' : 'btn-ghost'}
          style={{ fontSize: 13, padding: '6px 12px', whiteSpace: 'nowrap' }}
          onClick={() => {
            if (bulkMode) {
              setBulkMode(false);
              setSelected(new Set());
            } else {
              setBulkMode(true);
            }
          }}
        >
          {bulkMode ? 'Done' : 'Select'}
        </button>
      </div>

      {!hasResults ? (
        <div className="empty">
          <p style={{ fontSize: 15 }}>No events match.</p>
        </div>
      ) : searchActive ? (
        <div className="event-stack">
          {sortedFiltered.map(renderEventRow)}
        </div>
      ) : (
        <>
          {sortedUpcoming.length > 0 && (
            <>
              <SectionHeader label="Upcoming" />
              <div className="event-stack">
                {sortedUpcoming.map(renderEventRow)}
              </div>
            </>
          )}

          {sortedPast.length > 0 && (
            <div style={{ marginTop: sortedUpcoming.length > 0 ? 20 : 0 }}>
              <SectionHeader label="Past" />
              {!pastOpen ? (
                <button
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: '6px 12px' }}
                  onClick={() => setPastOpen(true)}
                >
                  ▶ Show {sortedPast.length} past event{sortedPast.length !== 1 ? 's' : ''}
                </button>
              ) : (
                <>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 13, padding: '6px 12px', marginBottom: 10 }}
                    onClick={() => setPastOpen(false)}
                  >
                    ▼ Hide past events
                  </button>
                  <div className="event-stack">
                    {sortedPast.map(renderEventRow)}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {bulkMode && selected.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: 'var(--glass-bg)',
          border: '1px solid var(--line-strong)',
          borderRadius: 14,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
        }}>
          <button className="btn" style={{ fontSize: 13 }} onClick={handleBulkDelete}>
            Delete {selected.size} event{selected.size !== 1 ? 's' : ''}
          </button>
          <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}
    </>
  );
}
