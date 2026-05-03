import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const DEFAULT_SETTINGS = {
  quickAddMode: false,
  autoDeleteMode: false,
  showDayOfWeekMode: false,
};

export function useSettings(uid) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
      }
    });
  }, [uid]);

  async function updateSettings(partial) {
    const next = { ...settings, ...partial };
    setSettings(next);
    if (uid) {
      await setDoc(doc(db, 'users', uid), next, { merge: true });
    }
  }

  return [settings, updateSettings];
}
