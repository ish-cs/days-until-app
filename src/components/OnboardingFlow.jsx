import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import AddEventForm from './AddEventForm.jsx';

const SUGGESTION_CARDS = [
  { label: 'My birthday', name: 'My Birthday', date: nextYearToday() },
  { label: 'Upcoming trip', name: 'My Trip', date: '' },
  { label: 'Work deadline', name: 'Deadline:', date: '' },
  { label: "Friend's wedding", name: 'Wedding', date: '' },
  { label: 'Holiday', name: '', date: '' },
  { label: 'Something else', name: '', date: '' },
];

function nextYearToday() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function writeStep(uid, s) {
  await setDoc(doc(db, 'users', uid), { onboardingStep: s }, { merge: true });
}

async function completeOnboarding(uid, onComplete) {
  await setDoc(doc(db, 'users', uid), { onboardingComplete: true }, { merge: true });
  onComplete();
}

export default function OnboardingFlow({ uid, user, onComplete, events, showToast }) {
  const [step, setStep] = useState(0);
  const [preFill, setPreFill] = useState({ name: '', date: '' });
  const [addedEvents, setAddedEvents] = useState([]);

  function goTo(s) {
    setStep(s);
    writeStep(uid, s);
  }

  function handleCardSelect(card) {
    setPreFill({ name: card.name, date: card.date });
    goTo(2);
  }

  function handleEventAdded(ev) {
    setAddedEvents(prev => [...prev, ev]);
    goTo(3);
  }

  useEffect(() => {
    if (step === 3 && (events.length + addedEvents.length) >= 4) {
      goTo(4);
    }
  }, [events, addedEvents, step]);

  useEffect(() => {
    if (step === 5) {
      const t = setTimeout(() => completeOnboarding(uid, onComplete), 1500);
      return () => clearTimeout(t);
    }
  }, [step]);

  const totalEvents = events.length + addedEvents.length;
  const usedLabels = addedEvents.map(e => e.name);

  const showSkip = step <= 3;
  const showBack = step >= 1 && step <= 3;
  const totalSteps = 6;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: '#0a0a0c', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '0 24px',
      }}>
        {showBack && (
          <button
            onClick={() => goTo(step - 1)}
            style={{
              position: 'absolute', left: 24,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-2)', fontSize: 20, lineHeight: 1, padding: 4,
            }}
            aria-label="Go back"
          >
            &#8592;
          </button>
        )}
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i === step ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
            transition: 'background 300ms',
          }} />
        ))}
        {showSkip && (
          <button
            onClick={() => goTo(5)}
            style={{
              position: 'absolute', right: 24,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', fontSize: 13, padding: 4,
            }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Step content */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {step === 0 && <StepWelcome onNext={() => goTo(1)} />}
        {step === 1 && <StepCards usedLabels={usedLabels} onSelect={handleCardSelect} />}
        {step === 2 && (
          <StepFirstEvent
            uid={uid}
            preFill={preFill}
            showToast={showToast}
            onEventAdded={handleEventAdded}
          />
        )}
        {step === 3 && (
          <StepAddMore
            addedEvents={addedEvents}
            totalEvents={totalEvents}
            usedLabels={usedLabels}
            onSelect={handleCardSelect}
            onSkip={() => goTo(4)}
          />
        )}
        {step === 4 && <StepNotifications onNext={() => goTo(5)} />}
        {step === 5 && <StepComplete totalEvents={totalEvents} />}
      </div>
    </div>
  );
}

function StepWelcome({ onNext }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <h1 style={{ color: 'var(--ink-0)', fontSize: 28, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
        See exactly how far away everything is.
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 16, margin: 0 }}>
        Track countdowns to the moments that matter.
      </p>
      <button onClick={onNext} style={primaryBtn}>Get started</button>
    </div>
  );
}

function StepCards({ usedLabels, onSelect }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
      <h2 style={{ color: 'var(--ink-0)', fontSize: 22, fontWeight: 600, margin: 0 }}>
        What are you counting down to?
      </h2>
      <div style={cardGrid}>
        {SUGGESTION_CARDS.map(card => {
          const used = usedLabels.includes(card.name) && card.name;
          return (
            <div
              key={card.label}
              className="glass"
              onClick={() => !used && onSelect(card)}
              style={{
                padding: 16, textAlign: 'center', cursor: used ? 'default' : 'pointer',
                fontSize: 14, color: 'var(--ink-1)', borderRadius: 18,
                opacity: used ? 0.4 : 1,
                pointerEvents: used ? 'none' : 'auto',
                transition: 'background 200ms',
              }}
              onMouseEnter={e => { if (!used) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              {card.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepFirstEvent({ uid, preFill, showToast, onEventAdded }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
      <h2 style={{ color: 'var(--ink-0)', fontSize: 22, fontWeight: 600, margin: 0 }}>
        Add your first event
      </h2>
      <div style={{ width: '100%' }}>
        <AddEventForm
          uid={uid}
          settings={{ quickAddMode: false }}
          showToast={showToast}
          prefillName={preFill.name}
          prefillDate={preFill.date}
          onEventAdded={onEventAdded}
          submitLabel="Add my first event"
        />
      </div>
    </div>
  );
}

function StepAddMore({ addedEvents, totalEvents, usedLabels, onSelect, onSkip }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
      <h2 style={{ color: 'var(--ink-0)', fontSize: 22, fontWeight: 600, margin: 0 }}>
        {addedEvents.length > 0
          ? `Added! What else are you looking forward to?`
          : 'Add more events'}
      </h2>
      {totalEvents > 0 && (
        <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>
          {totalEvents} event{totalEvents !== 1 ? 's' : ''} on your timeline
        </p>
      )}
      <div style={cardGrid}>
        {SUGGESTION_CARDS.map(card => {
          const used = usedLabels.includes(card.name) && card.name;
          return (
            <div
              key={card.label}
              className="glass"
              onClick={() => !used && onSelect(card)}
              style={{
                padding: 16, textAlign: 'center', cursor: used ? 'default' : 'pointer',
                fontSize: 14, color: 'var(--ink-1)', borderRadius: 18,
                opacity: used ? 0.4 : 1,
                pointerEvents: used ? 'none' : 'auto',
                transition: 'background 200ms',
              }}
              onMouseEnter={e => { if (!used) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              {card.label}
            </div>
          );
        })}
      </div>
      <button
        onClick={onSkip}
        style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', padding: 4 }}
      >
        I'll add more later
      </button>
    </div>
  );
}

function StepNotifications({ onNext }) {
  const canRequest = typeof Notification !== 'undefined' && Notification.permission === 'default';

  useEffect(() => {
    if (!canRequest) onNext();
  }, []);

  if (!canRequest) return null;

  async function handleAllow() {
    await Notification.requestPermission().catch(() => {});
    onNext();
  }

  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,215,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <h2 style={{ color: 'var(--ink-0)', fontSize: 22, fontWeight: 600, margin: 0 }}>
        Never miss a countdown
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 15, margin: 0 }}>
        Get reminders before your events arrive.
      </p>
      <button onClick={handleAllow} style={primaryBtn}>Turn on reminders</button>
      <button onClick={onNext} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', padding: 4 }}>
        Not now
      </button>
    </div>
  );
}

function StepComplete({ totalEvents }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h2 style={{ color: 'var(--ink-0)', fontSize: 26, fontWeight: 700, margin: 0 }}>
        Your timeline is ready.
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 15, margin: 0 }}>
        {totalEvents} event{totalEvents !== 1 ? 's' : ''} and counting.
      </p>
    </div>
  );
}

const primaryBtn = {
  background: 'var(--accent)',
  color: '#0a0a0c',
  border: 'none',
  borderRadius: 10,
  padding: '10px 24px',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  width: '100%',
  maxWidth: 400,
};
