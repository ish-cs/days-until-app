import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const DEFAULT_SETTINGS = {
  quickAddMode: false,
  autoDeleteMode: false,
  showDayOfWeekMode: false,
  notificationsEnabled: false,
  notificationLeadDays: [7, 1, 0],
  defaultTimezone: '',
};

export function useSettings(uid) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(async snap => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
      }
      if (!snap.data()?.defaultTimezone) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await setDoc(doc(db, 'users', uid), { defaultTimezone: tz }, { merge: true });
        setSettings(prev => ({ ...prev, defaultTimezone: tz }));
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
