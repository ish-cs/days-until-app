import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.js';
import AuthScreen from './components/AuthScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import EventList from './components/EventList.jsx';
import AddEventForm from './components/AddEventForm.jsx';
import SettingsMenu from './components/SettingsMenu.jsx';
import Toast from './components/Toast.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import OnboardingFlow from './components/OnboardingFlow.jsx';
import { useSettings } from './hooks/useSettings.js';
import { useDynamicFavicon } from './hooks/useDynamicFavicon.js';

export default function App() {
  useDynamicFavicon();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [events, setEvents] = useState([]);
  const [onboardingComplete, setOnboardingComplete] = useState(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [composerPrefillDate, setComposerPrefillDate] = useState(null);
  const [settings, updateSettings] = useSettings(user?.uid);

  const handleComposerPrefillConsumed = useCallback(() => {
    setComposerPrefillDate(null);
  }, []);

  const handleCalendarSelectDate = useCallback((dateStr) => {
    setCalendarSelectedDate(dateStr);
    setComposerPrefillDate(dateStr);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u || null);
      setAuthLoading(false);
      if (u) {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, { onboardingComplete: false, onboardingStep: 0, createdAt: serverTimestamp() });
          setOnboardingComplete(false);
        } else {
          setOnboardingComplete(snap.data().onboardingComplete === true);
        }
      } else {
        setOnboardingComplete(null);
      }
    });
    return unsub;
  }, []);

  function showToast(message, type = 'error') {
    setToast({ message, type });
  }

  function showConfirm(message, onConfirm, onCancel) {
    setConfirm({ message, onConfirm, onCancel });
  }

  async function handleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      showToast('Login failed: ' + err.message);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (err) {
      showToast('Logout failed: ' + err.message);
    }
  }

  if (authLoading) return null;

  const forceOnboarding =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('onboarding');
  if (!user) {
    if (forceOnboarding) {
      return (
        <>
          <OnboardingFlow
            uid={null}
            user={null}
            events={[]}
            showToast={showToast}
            disableWrites
            onComplete={() => {}}
          />
          {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
        </>
      );
    }
    return (
      <>
        <AuthScreen onLogin={handleLogin} />
        {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      </>
    );
  }

  const showOnboarding = onboardingComplete === false && events.length < 5;
  const shouldShowOnboarding = showOnboarding || forceOnboarding;

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            onLogout={handleLogout}
            onOpenSettings={() => setSettingsOpen(true)}
            events={events}
            calendarSelectedDate={calendarSelectedDate}
            onCalendarSelectDate={handleCalendarSelectDate}
          />
        </aside>
        <main className="main-col">
          <EventList
            uid={user.uid}
            settings={settings}
            showToast={showToast}
            showConfirm={showConfirm}
            onEventsChange={setEvents}
            calendarHighlightDate={calendarSelectedDate}
          />
        </main>
      </div>
      <AddEventForm
        uid={user.uid}
        settings={settings}
        showToast={showToast}
        events={events}
        composerPrefillDate={composerPrefillDate}
        onComposerPrefillConsumed={handleComposerPrefillConsumed}
      />
      {settingsOpen && (
        <SettingsMenu
          user={user}
          settings={settings}
          updateSettings={updateSettings}
          uid={user.uid}
          onClose={() => setSettingsOpen(false)}
          showToast={showToast}
          showConfirm={showConfirm}
          suppressEscapeClose={!!confirm}
        />
      )}
      {shouldShowOnboarding && (
        <OnboardingFlow
          uid={user.uid}
          user={user}
          events={events}
          showToast={showToast}
          onComplete={() => setOnboardingComplete(true)}
          disableWrites={forceOnboarding}
        />
      )}
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => { if (confirm.onCancel) confirm.onCancel(); setConfirm(null); }}
        />
      )}
    </>
  );
}
