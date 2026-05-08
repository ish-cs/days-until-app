import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { detectRecurrencePreview } from '../utils/recurrencePreview.js';
import { usePlaceholder } from '../hooks/usePlaceholder.js';
import {
  createAutocompleteEngine,
  getHistorySuggestion,
  buildHistoryBoost,
} from '../utils/composerAutocomplete.js';

const QUICK_ADD_COOLDOWN_MS = 4000;
const COMPLETE_DEBOUNCE_MS = 300;

function cleanRemoteSuffix(suffix, text) {
  if (typeof suffix !== 'string') return '';
  if (/[\r\n]/.test(suffix)) return '';
  const s = suffix.trim();
  if (s.length > 48) return '';
  if (s.length > text.length + 20) return '';
  if (s && text.toLowerCase().endsWith(s.toLowerCase())) return '';
  return s;
}

/** Normalize event date for Groq context (string YYYY-MM-DD or Firestore Timestamp). */
function toContextDateString(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') {
    const s = v.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    const d = v.toDate();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  return '';
}

export default function AddEventForm({
  uid, settings, showToast, events = [],
  composerPrefillDate = null, onComposerPrefillConsumed,
  prefillName = null, onEventAdded = null,
  submitLabel = 'Add'
}) {
  const [name, setName] = useState('');
  const [recurrencePreview, setRecurrencePreview] = useState(null);
  const [remoteSuffix, setRemoteSuffix] = useState('');
  const [engine, setEngine] = useState(null);
  const cooldownRef = useRef(false);
  const completeTimerRef = useRef(null);
  const completeAbortRef = useRef(null);
  const completeSeqRef = useRef(0);
  const inputRef = useRef(null);
  const mirrorRef = useRef(null);
  const placeholder = usePlaceholder(uid, events);

  const historyMap = useMemo(
    () => buildHistoryBoost(events.map((e) => e.name).filter(Boolean)),
    [events]
  );

  useEffect(() => {
    let cancelled = false;
    createAutocompleteEngine().then((e) => {
      if (!cancelled) setEngine(e);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const localSuggestion = useMemo(() => {
    if (!engine || !name || name.endsWith(' ')) return null;
    return getHistorySuggestion(name, engine, historyMap);
  }, [engine, name, historyMap]);

  const displaySuffix = (localSuggestion?.suffix ?? '') || remoteSuffix;

  useEffect(() => {
    setRemoteSuffix('');
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    if (completeAbortRef.current) {
      completeAbortRef.current.abort();
      completeAbortRef.current = null;
    }

    if (localSuggestion || !name.trim() || name.length < 2) return undefined;

    const seq = ++completeSeqRef.current;
    completeTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      completeAbortRef.current = controller;
      try {
        const res = await fetch('/.netlify/functions/groq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            text: name,
            today: new Date().toLocaleDateString('en-CA'),
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (seq !== completeSeqRef.current) return;
        const s = cleanRemoteSuffix(data?.suffix ?? '', name);
        if (s) setRemoteSuffix(s);
      } catch {
        if (seq === completeSeqRef.current) setRemoteSuffix('');
      }
    }, COMPLETE_DEBOUNCE_MS);

    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, [name, localSuggestion]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;
    mirror.scrollLeft = el.scrollLeft;
  }, [name, displaySuffix]);

  useEffect(() => {
    return () => {
      if (completeAbortRef.current) completeAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!composerPrefillDate) return;
    onComposerPrefillConsumed?.();
  }, [composerPrefillDate, onComposerPrefillConsumed]);

  useEffect(() => {
    if (prefillName != null) setName(prefillName);
  }, [prefillName]);

  const applyCompletion = useCallback(() => {
    if (!displaySuffix) return;
    setName((n) => n + displaySuffix);
    setRemoteSuffix('');
  }, [displaySuffix]);

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
      const allEvents = snapshot.docs.map((d) => {
        const data = d.data();
        const dateNorm = toContextDateString(data.date);
        return {
          id: d.id,
          ...data,
          ...(dateNorm ? { date: dateNorm } : {}),
        };
      });

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
      setRemoteSuffix('');
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
            <div className="composer-field-wrap">
              <div
                ref={mirrorRef}
                className="composer-input-mirror"
                aria-hidden
              >
                {name}
                {displaySuffix ? (
                  <span className="composer-input-mirror-ghost">{displaySuffix}</span>
                ) : null}
              </div>
              <input
                ref={inputRef}
                type="text"
                className="input composer-field composer-field-autocomplete"
                placeholder={placeholder}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setRecurrencePreview(detectRecurrencePreview(e.target.value));
                }}
                onScroll={() => {
                  if (mirrorRef.current && inputRef.current) {
                    mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && displaySuffix) {
                    e.preventDefault();
                    applyCompletion();
                  } else if (e.key === 'ArrowRight' && displaySuffix && inputRef.current) {
                    const el = inputRef.current;
                    if (el.selectionStart === el.selectionEnd && el.selectionEnd === name.length) {
                      e.preventDefault();
                      applyCompletion();
                    }
                  }
                }}
                aria-label="Describe event to add"
                aria-autocomplete="list"
                aria-describedby="composer-autocomplete-hint"
              />
            </div>
            <span id="composer-autocomplete-hint" className="visually-hidden">
              Dimmed suggestion may appear; press Tab to accept it.
            </span>
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
