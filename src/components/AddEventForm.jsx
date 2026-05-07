import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { ACCENT_COLORS, COLOR_NAMES } from '../utils/colors.js';
const QUICK_ADD_COOLDOWN_MS = 4000;

export default function AddEventForm({
  uid, settings, showToast,
  composerPrefillDate = null, onComposerPrefillConsumed
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow-300');
  const [recurrence, setRecurrence] = useState('');
  const [notes, setNotes] = useState('');
  const cooldownRef = useRef(false);

  const isQuickAdd = Boolean(settings?.quickAddMode);

  useEffect(() => {
    if (!composerPrefillDate) return;
    if (isQuickAdd) {
      onComposerPrefillConsumed?.();
      return;
    }
    setDate(composerPrefillDate);
    onComposerPrefillConsumed?.();
  }, [composerPrefillDate, isQuickAdd, onComposerPrefillConsumed]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isQuickAdd) {
      await handleQuickAdd(name);
    } else {
      if (!name.trim() || !date) {
        showToast('Please add a name and date.');
        return;
      }
      await saveEvent(name.trim(), date, time, selectedColor, recurrence, notes);
      setName('');
      setDate('');
      setTime('');
      setRecurrence('');
      setNotes('');
    }
  }

  async function handleQuickAdd(userInput) {
    if (!userInput.trim()) return;
    if (cooldownRef.current) {
      showToast('Please wait 4 seconds before adding another.');
      return;
    }

    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, QUICK_ADD_COOLDOWN_MS);

    try {
      const snapshot = await getDocs(collection(db, 'users', uid, 'events'));
      const allEvents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const response = await fetch('/.netlify/functions/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userInput, context: allEvents, today: new Date().toLocaleDateString('en-CA') })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || 'Quick add is temporarily unavailable.';
        throw new Error(msg);
      }

      if (!data.name || !data.date) throw new Error('Could not understand. Try a clearer event and date.');

      await saveEvent(data.name, data.date, data.time || '', data.color || selectedColor, data.recurrence || null);
      setName('');
    } catch (err) {
      showToast(err?.message || 'Could not understand. Try a clearer event and date.');
    }
  }

  async function saveEvent(eventName, eventDate, eventTime, bgColor, eventRecurrence, eventNotes = '') {
    if (!uid) return;
    const payload = { name: eventName, date: eventDate, time: eventTime, bgColor, owner: uid };
    if (eventRecurrence) payload.recurrence = eventRecurrence;
    if (eventNotes.trim()) payload.notes = eventNotes.trim();
    await addDoc(collection(db, 'users', uid, 'events'), payload);
    showToast('Event added!', 'success');
  }

  return (
    <div className="composer-dock" aria-label="Add event">
      <div className="composer-inner glass">
        <form className="composer-form" onSubmit={handleSubmit} autoComplete="off">
          {!isQuickAdd && (
            <div className="composer-meta">
              <input
                type="date"
                className="input composer-input-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Event date"
              />
              <input
                type="time"
                className="input composer-input-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Event time"
              />
              <div className="composer-swatches" role="group" aria-label="Event color">
                {COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={'composer-swatch' + (selectedColor === color ? ' selected' : '')}
                    style={{ background: ACCENT_COLORS[color] }}
                    onClick={() => setSelectedColor(color)}
                    title={color}
                    aria-label={`Color ${color}`}
                    aria-pressed={selectedColor === color}
                  />
                ))}
              </div>
              <select
                className="input composer-input-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                aria-label="Recurrence"
              >
                <option value="">Does not repeat</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <textarea
                className="input"
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                style={{ resize: 'none', fontSize: 13 }}
                aria-label="Event notes"
              />
            </div>
          )}

          <div className="composer-main">
            <input
              type="text"
              className="input composer-field"
              placeholder={
                isQuickAdd
                  ? 'Add an event… e.g. Dentist next Tuesday 3pm'
                  : 'Event name'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={isQuickAdd ? 'Describe event to add' : 'Event name'}
            />
            <button type="submit" className="btn composer-submit">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
