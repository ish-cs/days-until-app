import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { calculateDaysLeft, formatFullDate, getDayOfWeek, getEffectiveDate } from '../utils/dates.js';
import { ACCENT_COLORS, COLOR_NAMES } from '../utils/colors.js';

export default function EventItem({
  event, uid, showDayOfWeek, onDelete, onColorChange, showToast,
  id, highlighted = false,
  colorPicker = null,
  onOpenColorPicker,
  onCloseColorPicker
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);
  const colorMenuRef = useRef(null);

  const effectiveDate = getEffectiveDate(event);
  const days = calculateDaysLeft(effectiveDate);
  const fullDate = formatFullDate(effectiveDate);
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

  useEffect(() => {
    if (!colorPicker) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onCloseColorPicker?.();
    }
    function onPointerDown(e) {
      if (colorMenuRef.current?.contains(e.target)) return;
      onCloseColorPicker?.();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [colorPicker, onCloseColorPicker]);

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

  function clampMenuPosition(x, y) {
    const pad = 8;
    const mw = 176;
    const mh = 88;
    let nx = x;
    let ny = y;
    nx = Math.min(nx, window.innerWidth - mw - pad);
    ny = Math.min(ny, window.innerHeight - mh - pad);
    nx = Math.max(pad, nx);
    ny = Math.max(pad, ny);
    return { x: nx, y: ny };
  }

  function handleCardContextMenu(e) {
    if (e.target.closest('.row-actions')) return;
    if (e.target.closest('input, textarea')) return;
    e.preventDefault();
    const { x, y } = clampMenuPosition(e.clientX, e.clientY);
    onOpenColorPicker?.(event.id, x, y);
  }

  function pickColor(colorKey) {
    onColorChange(event.id, colorKey);
    onCloseColorPicker?.();
  }

  const menuPortal = colorPicker && createPortal(
    <div
      ref={colorMenuRef}
      className="event-color-menu glass"
      role="menu"
      aria-label="Event accent color"
      style={{ left: colorPicker.x, top: colorPicker.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {COLOR_NAMES.map((colorKey) => (
        <button
          key={colorKey}
          type="button"
          role="menuitem"
          className={'event-color-swatch' + (bgColor === colorKey ? ' selected' : '')}
          style={{ background: ACCENT_COLORS[colorKey] }}
          onClick={() => pickColor(colorKey)}
          title={colorKey}
          aria-label={colorKey}
          aria-current={bgColor === colorKey ? 'true' : undefined}
        />
      ))}
    </div>,
    document.body
  );

  return (
    <>
      {menuPortal}
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
        title="Right-click to choose accent color"
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
              {event.recurrence && (
                <span className="recurrence-badge">
                  ↻ {event.recurrence.charAt(0).toUpperCase() + event.recurrence.slice(1)}
                </span>
              )}
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
    </>
  );
}
