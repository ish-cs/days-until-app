import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { detectRecurrencePreview } from '../utils/recurrencePreview.js';
const QUICK_ADD_COOLDOWN_MS = 4000;

export default function AddEventForm({
  uid, settings, showToast,
  composerPrefillDate = null, onComposerPrefillConsumed,
  prefillName = null, onEventAdded = null,
  submitLabel = 'Add'
}) {
  const [name, setName] = useState('');
  const [recurrencePreview, setRecurrencePreview] = useState(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!composerPrefillDate) return;
    onComposerPrefillConsumed?.();
  }, [composerPrefillDate, onComposerPrefillConsumed]);

  useEffect(() => {
    if (prefillName != null) setName(prefillName);
  }, [prefillName]);

  async function handleSubmit(e) {
    e.preventDefault();
    await handleQuickAdd(name);
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

      await saveEvent(data.name, data.date, data.time || '', data.color || 'yellow-300', data.recurrence || null);
      setName('');
      setRecurrencePreview(null);
    } catch (err) {
      showToast(err?.message || 'Could not understand. Try a clearer event and date.');
    }
  }

  async function saveEvent(eventName, eventDate, eventTime, bgColor, eventRecurrence) {
    if (!uid) return;
    const payload = { name: eventName, date: eventDate, time: eventTime, bgColor, owner: uid, createdAt: serverTimestamp(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (eventRecurrence) {
      payload.recurrence = eventRecurrence;
    }
    await addDoc(collection(db, 'users', uid, 'events'), payload);
    showToast('Event added!', 'success');
    onEventAdded?.({ name: eventName, date: eventDate });
  }

  return (
    <div className="composer-dock" aria-label="Add event">
      <div className="composer-inner glass">
        <form className="composer-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="composer-main">
            <input
              type="text"
              className="input composer-field"
              placeholder="Add an event… e.g. Dentist next Tuesday 3pm"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setRecurrencePreview(detectRecurrencePreview(e.target.value));
              }}
              aria-label="Describe event to add"
            />
            <button type="submit" className="btn composer-submit">
              {submitLabel}
            </button>
          </div>
          {recurrencePreview && (
            <div className="recurrence-preview-chip">
              Repeats: {recurrencePreview}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
