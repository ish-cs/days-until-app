import React, { useState } from 'react';
import { formatTodayISO } from '../utils/dates.js';

export default function MiniCalendar({ events = [], selectedDate = null, onSelectDate }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const eventDates = new Set(events.map((e) => e.date));

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onSelectDate?.(formatTodayISO());
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
  const firstDayMon = (firstDayRaw + 6) % 7;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayMon; i++) {
    cells.push({ day: prevMonthDays - firstDayMon + 1 + i, overflow: 'prev' });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, overflow: null });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, overflow: 'next' });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function cellDateStr(cell) {
    if (cell.overflow === 'prev') {
      const m = viewMonth === 0 ? 12 : viewMonth;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      return `${y}-${pad(m)}-${pad(cell.day)}`;
    }
    if (cell.overflow === 'next') {
      const m = viewMonth === 11 ? 1 : viewMonth + 2;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      return `${y}-${pad(m)}-${pad(cell.day)}`;
    }
    return `${viewYear}-${pad(viewMonth + 1)}-${pad(cell.day)}`;
  }

  return (
    <div aria-label="Mini calendar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>
          {monthNames[viewMonth]} {viewYear}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={goToday} title="Jump to today">
            Today
          </button>
          <button type="button" className="icon-btn" onClick={prevMonth} title="Previous month" aria-label="Previous month">‹</button>
          <button type="button" className="icon-btn" onClick={nextMonth} title="Next month" aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cal-head" aria-hidden="true">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="cal-grid" role="group" aria-label={`${monthNames[viewMonth]} ${viewYear}`}>
        {cells.map((cell, i) => {
          const isOverflow = cell.overflow !== null;
          const isToday = !isOverflow
            && cell.day === today.getDate()
            && viewMonth === today.getMonth()
            && viewYear === today.getFullYear();

          const dateStr = cellDateStr(cell);
          const hasEvent = eventDates.has(dateStr);
          const isSelected = selectedDate != null && dateStr === selectedDate;

          let className = 'cal-cell';
          if (isOverflow) className += ' muted';
          if (isToday) className += ' today';
          if (hasEvent) className += ' has-event';
          if (isSelected) className += ' selected';

          return (
            <button
              key={i}
              type="button"
              className={className}
              onClick={() => onSelectDate?.(dateStr)}
              aria-label={`${dateStr}${hasEvent ? ', has events' : ''}${isToday ? ', today' : ''}`}
              aria-pressed={isSelected}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
