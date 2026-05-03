import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { calculateDaysLeft, formatFullDate, getDayOfWeek } from '../utils/dates.js';
import { ACCENT_COLORS } from '../utils/colors.js';

export default function EventItem({
  event, uid, showDayOfWeek, onDelete, onColorChange, showToast,
  id, highlighted = false
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  const days = calculateDaysLeft(event.date);
  const fullDate = formatFullDate(event.date);
  const bgColor = event.bgColor || 'yellow-300';
  const accentHex = ACCENT_COLORS[bgColor] || ACCENT_COLORS['yellow-300'];

  const dateDisplay = showDayOfWeek
    ? `${getDayOfWeek(event.date)}, ${fullDate}`
    : fullDate;

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m} ${ampm}`;
  }

  function startEdit(field, value) {
    setEditingField(field);
    setEditValue(value);
  }

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  async function commitEdit() {
    const newValue = editValue.trim();
    if (newValue && newValue !== (editingField === 'name' ? event.name : event.date)) {
      try {
        await updateDoc(doc(db, 'users', uid, 'events', event.id), {
          [editingField]: newValue
        });
        showToast('Event updated successfully!', 'success');
      } catch {
        showToast('Failed to update event.');
      }
    }
    setEditingField(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') setEditingField(null);
  }

  function handleCardContextMenu(e) {
    if (e.target.closest('.row-actions')) return;
    if (e.target.closest('input, textarea')) return;
    e.preventDefault();
    const colorKeys = Object.keys(ACCENT_COLORS);
    const currentIdx = colorKeys.indexOf(bgColor);
    const nextColor = colorKeys[(currentIdx + 1) % colorKeys.length];
    onColorChange(event.id, nextColor);
  }

  return (
    <div
      id={id}
      className={
        'event-card glass fade-in'
        + (highlighted ? ' cal-highlight' : '')
        + (days < 0 ? ' event-past' : '')
      }
      style={{ '--row-accent': accentHex }}
      data-accent=""
      onContextMenu={handleCardContextMenu}
      title="Right-click anywhere on the tile to change accent color"
    >
      <div className={`num serif${days === 0 ? ' word-mode' : ''}`}>
        <span className="digit-roll" key={days}>
          {days === 0 ? 'Today' : Math.abs(days)}
        </span>
        {days !== 0 && (
          <span className="unit">{days < 0 ? 'ago' : 'days'}</span>
        )}
      </div>

      <div className="event-meta">
        {editingField === 'name' ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="input event-inline-input"
          />
        ) : (
          <div
            className="event-name-line"
            onClick={() => startEdit('name', event.name)}
            title="Click to edit name"
          >
            {event.name}
          </div>
        )}
        {editingField === 'date' ? (
          <input
            ref={inputRef}
            type="date"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="input event-inline-date"
          />
        ) : (
          <div
            className="event-date-line"
            onClick={() => startEdit('date', event.date)}
            title="Click to edit date"
          >
            {dateDisplay}{event.time && ` · ${formatTime(event.time)}`}
          </div>
        )}
      </div>

      <div className="row-actions">
        <button
          className="icon-btn"
          onClick={() => startEdit('name', event.name)}
          title="Edit"
        >
          ✎
        </button>
        <button
          className="icon-btn"
          onClick={(e) => onDelete(event, e.shiftKey)}
          title="Delete (shift+click to skip confirm)"
          style={{ color: 'var(--ink-2)' }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
