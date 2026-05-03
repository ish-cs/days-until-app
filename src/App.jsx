import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import AuthScreen from './components/AuthScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import EventList from './components/EventList.jsx';
import AddEventForm from './components/AddEventForm.jsx';
import SettingsMenu from './components/SettingsMenu.jsx';
import Toast from './components/Toast.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import { useSettings } from './hooks/useSettings.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [events, setEvents] = useState([]);
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
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u || null);
      setAuthLoading(false);
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

  if (!user) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} />
        {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      </>
    );
  }

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
