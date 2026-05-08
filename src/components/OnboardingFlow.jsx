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

async function writeStep(uid, s, { disableWrites = false } = {}) {
  if (disableWrites || !uid) return;
  await setDoc(doc(db, 'users', uid), { onboardingStep: s }, { merge: true });
}

async function completeOnboarding(uid, onComplete, { disableWrites = false } = {}) {
  if (!disableWrites && uid) {
    await setDoc(doc(db, 'users', uid), { onboardingComplete: true }, { merge: true });
  }
  onComplete?.();
}

export default function OnboardingFlow({ uid, user, onComplete, events, showToast, disableWrites = false }) {
  const [step, setStep] = useState(0);
  const [preFill, setPreFill] = useState({ name: '', date: '' });
  const [addedEvents, setAddedEvents] = useState([]);

  function goTo(s) {
    setStep(s);
    writeStep(uid, s, { disableWrites });
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
      const t = setTimeout(() => completeOnboarding(uid, onComplete, { disableWrites }), 1500);
      return () => clearTimeout(t);
    }
  }, [step]);

  const totalEvents = events.length + addedEvents.length;
  const usedLabels = addedEvents.map(e => e.name);

  const showSkip = step <= 3;
  const showBack = step >= 1 && step <= 3;
  const totalSteps = 6;

  return (
    <div className="onboard-backdrop" role="dialog" aria-modal="true" aria-label="Onboarding">
      <div className="onboard-shell">
        <div className="onboard-topbar">
        {showBack && (
            <button onClick={() => goTo(step - 1)} className="btn btn-ghost" aria-label="Go back">
              ←
            </button>
        )}
          {!showBack ? <div className="onboard-topbar-spacer" aria-hidden /> : null}
        {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`onboard-step-dot ${i === step ? 'active' : ''}`} />
        ))}
        {showSkip && (
            <>
              <div className="onboard-topbar-spacer" aria-hidden />
              <button onClick={() => goTo(5)} className="onboard-link">Skip</button>
            </>
        )}
          {!showSkip ? <div className="onboard-topbar-spacer" aria-hidden /> : null}
        </div>

        <div className="glass onboard-panel">
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
    </div>
  );
}

function StepWelcome({ onNext }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 className="onboard-title hero">See exactly how far away everything is.</h1>
      <p className="onboard-subtitle">Track countdowns to the moments that matter.</p>
      <div className="onboard-actions">
        <button onClick={onNext} className="btn btn-primary">Get started</button>
      </div>
    </div>
  );
}

function StepCards({ usedLabels, onSelect }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 className="onboard-title">What are you counting down to?</h2>
      <div className="onboard-grid">
        {SUGGESTION_CARDS.map((card) => {
          const used = usedLabels.includes(card.name) && card.name;
          return (
            <button
              key={card.label}
              type="button"
              className={`glass onboard-card ${used ? 'disabled' : ''}`}
              onClick={() => !used && onSelect(card)}
            >
              {card.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepFirstEvent({ uid, preFill, showToast, onEventAdded }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 className="onboard-title">Add your first event</h2>
      <div className="onboard-subtitle" style={{ marginTop: -6 }}>
        Tip: you can type natural language like “Dentist next Tuesday 3pm”.
      </div>
      <div style={{ width: '100%', marginTop: 8 }}>
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
    <div style={{ textAlign: 'center' }}>
      <h2 className="onboard-title">
        {addedEvents.length > 0 ? 'Added! What else are you looking forward to?' : 'Add more events'}
      </h2>
      {totalEvents > 0 ? (
        <div className="onboard-meta">
          {totalEvents} event{totalEvents !== 1 ? 's' : ''} on your timeline
        </div>
      ) : null}
      <div className="onboard-grid" style={{ marginTop: 10 }}>
        {SUGGESTION_CARDS.map((card) => {
          const used = usedLabels.includes(card.name) && card.name;
          return (
            <button
              key={card.label}
              type="button"
              className={`glass onboard-card ${used ? 'disabled' : ''}`}
              onClick={() => !used && onSelect(card)}
            >
              {card.label}
            </button>
          );
        })}
      </div>
      <button onClick={onSkip} className="onboard-link">I’ll add more later</button>
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
    <div style={{ textAlign: 'center' }}>
      <div className="onboard-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <h2 className="onboard-title" style={{ marginTop: 14 }}>Never miss a countdown</h2>
      <p className="onboard-subtitle">Get reminders before your events arrive.</p>
      <div className="onboard-actions">
        <button onClick={handleAllow} className="btn btn-primary">Turn on reminders</button>
        <button onClick={onNext} className="onboard-link">Not now</button>
      </div>
    </div>
  );
}

function StepComplete({ totalEvents }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 className="onboard-title hero">Your timeline is ready.</h2>
      <p className="onboard-subtitle">{totalEvents} event{totalEvents !== 1 ? 's' : ''} and counting.</p>
    </div>
  );
}
