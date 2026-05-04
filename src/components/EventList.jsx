import React, { useCallback, useEffect, useState } from 'react';
import {
  collection, onSnapshot, doc, deleteDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { calculateDaysLeft, getEffectiveDate } from '../utils/dates.js';
import EventItem from './EventItem.jsx';

export default function EventList({
  uid, settings, showToast, showConfirm, onEventsChange,
  calendarHighlightDate = null
}) {
  const [events, setEvents] = useState([]);
  /** One open color context menu: which event + pointer position */
  const [colorMenu, setColorMenu] = useState(null);
  const closeColorPicker = useCallback(() => setColorMenu(null), []);

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

  if (events.length === 0) {
    return (
      <div className="empty">
        <p style={{ fontSize: 18, marginBottom: 8 }}>No events yet.</p>
        <p style={{ fontSize: 14 }}>Use the bar below to add your first event.</p>
      </div>
    );
  }

  return (
    <div className="event-stack">
      {events.map(event => (
        <EventItem
          key={event.id}
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
      ))}
    </div>
  );
}
