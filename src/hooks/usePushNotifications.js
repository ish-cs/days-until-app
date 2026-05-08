import { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function getSubscriptionId(endpoint) {
  const encoder = new TextEncoder();
  const data = encoder.encode(endpoint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export function usePushNotifications(uid) {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window;
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState(isSupported ? Notification.permission : 'denied');

  useEffect(() => {
    if (!isSupported || !uid) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setIsEnabled(!!sub);
      });
    });
  }, [uid, isSupported]);

  async function requestPermission() {
    if (!isSupported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const subJson = sub.toJSON();
    const subId = await getSubscriptionId(subJson.endpoint);
    await setDoc(doc(db, 'users', uid, 'pushSubscriptions', subId), {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      userAgent: navigator.userAgent.slice(0, 200),
      platform: 'web',
      fcmToken: null,
      createdAt: serverTimestamp(),
    });
    setIsEnabled(true);
  }

  async function unsubscribe() {
    if (!isSupported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const subId = await getSubscriptionId(sub.endpoint);
    await sub.unsubscribe();
    await deleteDoc(doc(db, 'users', uid, 'pushSubscriptions', subId));
    setIsEnabled(false);
  }

  return { isSupported, isEnabled, permission, requestPermission, unsubscribe };
}
