import { useState, useEffect, useRef } from 'react';

const TTL_MS = 150_000; // 2.5 minutes
const DEFAULT = 'Add an event… e.g. Dentist next Tuesday 3pm';

function cacheKey(uid) {
  return `placeholder_v1_${uid}`;
}

export function usePlaceholder(uid, events) {
  const [placeholder, setPlaceholder] = useState(DEFAULT);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!uid) return;

    const cached = (() => {
      try {
        const raw = localStorage.getItem(cacheKey(uid));
        if (!raw) return null;
        const { text, ts } = JSON.parse(raw);
        if (Date.now() - ts < TTL_MS) return text;
        return null;
      } catch {
        return null;
      }
    })();

    if (cached) {
      setPlaceholder(`Add an event… e.g. ${cached}`);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    fetch('/.netlify/functions/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'placeholder', context: events }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.placeholder) {
          localStorage.setItem(cacheKey(uid), JSON.stringify({ text: data.placeholder, ts: Date.now() }));
          setPlaceholder(`Add an event… e.g. ${data.placeholder}`);
        }
      })
      .catch(() => {})
      .finally(() => { fetchingRef.current = false; });
  }, [uid]);  // intentionally only on uid mount — events snapshot at call time

  return placeholder;
}
