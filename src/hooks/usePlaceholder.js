import { useState, useEffect, useRef } from 'react';

const DEFAULT = 'Add an event… e.g. Dentist next Tuesday 3pm';

export function usePlaceholder(uid, events) {
  const [placeholder, setPlaceholder] = useState(DEFAULT);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!uid || fetchingRef.current) return;
    fetchingRef.current = true;

    fetch('/.netlify/functions/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'placeholder', context: events }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.placeholder) {
          setPlaceholder(`Add an event… e.g. ${data.placeholder}`);
        }
      })
      .catch(() => {});
  }, [uid]);

  return placeholder;
}
