import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const FEED_BASE_URL = 'https://daysuntilapp.netlify.app/.netlify/functions/calendar-feed';

export function useCalendarFeed(uid) {
  const [feedUrl, setFeedUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentToken, setCurrentToken] = useState('');

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      const token = snap.data()?.calendarFeedToken;
      if (token) {
        setCurrentToken(token);
        setFeedUrl(`${FEED_BASE_URL}?token=${token}`);
      } else {
        generateToken(false);
      }
    });
  }, [uid]);

  async function generateToken(isRegen = false) {
    setIsGenerating(true);
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const token = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

    if (isRegen && currentToken) {
      await deleteDoc(doc(db, 'calendarTokens', currentToken));
    }

    await Promise.all([
      setDoc(doc(db, 'calendarTokens', token), { uid, createdAt: new Date() }),
      setDoc(doc(db, 'users', uid), { calendarFeedToken: token }, { merge: true }),
    ]);

    setCurrentToken(token);
    setFeedUrl(`${FEED_BASE_URL}?token=${token}`);
    setIsGenerating(false);
  }

  return { feedUrl, isGenerating, regenerate: () => generateToken(true) };
}
