import React from 'react';
import MiniCalendar from './MiniCalendar.jsx';

export default function Sidebar({
  user, onLogout, onOpenSettings, events,
  calendarSelectedDate, onCalendarSelectDate
}) {
  return (
    <div className="glass" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="serif" style={{ fontSize: 28, marginBottom: 4, margin: 0 }}>Days Until…</h1>
        <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 6 }}>
          {user.displayName || user.email}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" title="Settings" onClick={onOpenSettings}>
          ⚙ Settings
        </button>
        <button className="btn btn-ghost" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="divider" />

      <MiniCalendar
        events={events}
        selectedDate={calendarSelectedDate}
        onSelectDate={onCalendarSelectDate}
      />
    </div>
  );
}
