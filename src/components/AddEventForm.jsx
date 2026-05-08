import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { ACCENT_COLORS, COLOR_NAMES } from '../utils/colors.js';
import { detectRecurrencePreview } from '../utils/recurrencePreview.js';
const QUICK_ADD_COOLDOWN_MS = 4000;

export default function AddEventForm({
  uid, settings, showToast,
  composerPrefillDate = null, onComposerPrefillConsumed,
  prefillName = null, prefillDate = null, onEventAdded = null,
  submitLabel = 'Add'
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow-300');
  const [recurrence, setRecurrence] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrencePreview, setRecurrencePreview] = useState(null);
  const [isCountUp, setIsCountUp] = useState(false);
  const [recurrenceEndMode, setRecurrenceEndMode] = useState('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState('');
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

  useEffect(() => {
    if (prefillName != null) setName(prefillName);
  }, [prefillName]);

  useEffect(() => {
    if (prefillDate != null) setDate(prefillDate);
  }, [prefillDate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isQuickAdd) {
      await handleQuickAdd(name);
    } else {
      if (!name.trim() || !date) {
        showToast('Please add a name and date.');
        return;
      }
      await saveEvent(name.trim(), date, time, selectedColor, recurrence, notes, isCountUp, recurrenceEndMode, recurrenceEndDate, recurrenceCount);
      setName('');
      setDate('');
      setTime('');
      setRecurrence('');
      setNotes('');
      setIsCountUp(false);
      setRecurrenceEndMode('none');
      setRecurrenceEndDate('');
      setRecurrenceCount('');
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
      setRecurrencePreview(null);
    } catch (err) {
      showToast(err?.message || 'Could not understand. Try a clearer event and date.');
    }
  }

  async function saveEvent(eventName, eventDate, eventTime, bgColor, eventRecurrence, eventNotes = '', countUp = false, endMode = 'none', endDate = '', endCount = '') {
    if (!uid) return;
    if (endMode === 'date' && endDate && endDate <= eventDate) {
      showToast('End date must be after start date.');
      return;
    }
    const payload = { name: eventName, date: eventDate, time: eventTime, bgColor, owner: uid, createdAt: serverTimestamp(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (countUp) {
      payload.isCountUp = true;
    } else if (eventRecurrence) {
      payload.recurrence = eventRecurrence;
      payload.recurrenceEndDate = endMode === 'date' && endDate ? endDate : null;
      payload.recurrenceCount = endMode === 'count' && endCount ? parseInt(endCount, 10) : null;
    }
    if (eventNotes.trim()) payload.notes = eventNotes.trim();
    await addDoc(collection(db, 'users', uid, 'events'), payload);
    showToast('Event added!', 'success');
    onEventAdded?.({ name: eventName, date: eventDate });
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
                aria-label={isCountUp ? 'Since when?' : 'Event date'}
                placeholder={isCountUp ? 'Since when?' : undefined}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={isCountUp} onChange={e => setIsCountUp(e.target.checked)} />
                {isCountUp ? 'Since when?' : 'Count up (days since)'}
              </label>
              {!isCountUp && (
                <>
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
                  {recurrence && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                        <input type="radio" name="recEndMode" value="none" checked={recurrenceEndMode === 'none'} onChange={() => setRecurrenceEndMode('none')} />
                        Repeats forever
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                        <input type="radio" name="recEndMode" value="date" checked={recurrenceEndMode === 'date'} onChange={() => setRecurrenceEndMode('date')} />
                        End date:
                        {recurrenceEndMode === 'date' && (
                          <input type="date" className="input" style={{ flex: 1 }} value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} />
                        )}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                        <input type="radio" name="recEndMode" value="count" checked={recurrenceEndMode === 'count'} onChange={() => setRecurrenceEndMode('count')} />
                        After:
                        {recurrenceEndMode === 'count' && (
                          <input type="number" className="input" min="1" style={{ width: 70 }} value={recurrenceCount} onChange={e => setRecurrenceCount(e.target.value)} placeholder="N" />
                        )}
                        {recurrenceEndMode === 'count' && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>occurrences</span>}
                      </label>
                    </div>
                  )}
                </>
              )}
              <textarea
                className="input"
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
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
              onChange={(e) => {
                setName(e.target.value);
                if (isQuickAdd) setRecurrencePreview(detectRecurrencePreview(e.target.value));
              }}
              aria-label={isQuickAdd ? 'Describe event to add' : 'Event name'}
            />
            <button type="submit" className="btn composer-submit">
              {submitLabel}
            </button>
          </div>
          {isQuickAdd && recurrencePreview && (
            <div className="recurrence-preview-chip">
              Repeats: {recurrencePreview}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
