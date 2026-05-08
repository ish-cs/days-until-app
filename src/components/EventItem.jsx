import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { Download } from 'lucide-react';
import { db } from '../firebase.js';
import { calculateDaysLeft, calculateDaysSince, formatFullDate, getDayOfWeek, getEffectiveDate, formatRecurrenceLabel } from '../utils/dates.js';
import { ACCENT_COLORS, COLOR_NAMES } from '../utils/colors.js';
import { exportSingleEvent } from '../utils/icsExport.js';

export default function EventItem({
  event, uid, showDayOfWeek, onDelete, onColorChange, showToast,
  id, highlighted = false,
  colorPicker = null,
  onOpenColorPicker,
  onCloseColorPicker
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const inputRef = useRef(null);
  const colorMenuRef = useRef(null);

  const effectiveDate = getEffectiveDate(event);
  const days = calculateDaysLeft(effectiveDate);
  const isCountUp = event.isCountUp === true;
  const daysSince = isCountUp ? calculateDaysSince(event.date) : null;
  const fullDate = formatFullDate(effectiveDate);
  const bgColor = event.bgColor || 'yellow-300';
  const accentHex = ACCENT_COLORS[bgColor] || ACCENT_COLORS['yellow-300'];

  const dateDisplay = showDayOfWeek
    ? `${getDayOfWeek(effectiveDate)}, ${fullDate}`
    : fullDate;

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m} ${ampm}`;
  }

  function getShortTz(ianaTimezone) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: ianaTimezone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find(p => p.type === 'timeZoneName')?.value ?? ianaTimezone;
    } catch {
      return ianaTimezone;
    }
  }

  function formatTimeWithTz(t, storedTz) {
    if (!t) return '';
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const suffix = storedTz && storedTz !== userTz ? ` (${getShortTz(storedTz)})` : '';
    return `${h12}:${m} ${ampm}${suffix}`;
  }

  function startEdit(field, value) {
    setEditingField(field);
    setEditValue(value);
    if (field === 'notes') setNotesExpanded(true);
  }

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      if (editingField === 'notes') {
        const el = inputRef.current;
        el.setSelectionRange(el.value.length, el.value.length);
      }
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
    const field = editingField;
    const newValue = field === 'notes' ? editValue : editValue.trim();

    // For time, allow empty string (clears the field). For notes, always save.
    const shouldSave = field === 'time' || field === 'notes'
      ? newValue !== (event[field] ?? '')
      : newValue && newValue !== (field === 'name' ? event.name : event.date);

    if (shouldSave) {
      try {
        await updateDoc(doc(db, 'users', uid, 'events', event.id), {
          [field]: newValue
        });
        showToast('Event updated successfully!', 'success');
      } catch {
        showToast('Failed to update event.');
      }
    }
    setEditingField(null);
    if (field === 'notes' && !newValue) setNotesExpanded(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') setEditingField(null);
  }

  function handleNotesKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
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
        <div className={`num serif${(isCountUp ? daysSince === 0 : days === 0) ? ' word-mode' : ''}`}>
          <span className="digit-roll" key={isCountUp ? daysSince : days}>
            {isCountUp
              ? (daysSince === 0 ? 'Today' : Math.abs(daysSince))
              : (days === 0 ? 'Today' : Math.abs(days))
            }
          </span>
          {isCountUp ? (
            daysSince !== 0 && (
              <span className="unit">{daysSince > 0 ? 'days since' : 'days until'}</span>
            )
          ) : (
            days !== 0 && (
              <span className="unit">{days < 0 ? 'ago' : 'days'}</span>
            )
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
                  ↻ {formatRecurrenceLabel(event.date, event.recurrence)}
                </span>
              )}
              {event.recurrenceEndDate && (
                <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>until {event.recurrenceEndDate}</span>
              )}
              {event.recurrenceCount && !event.recurrenceEndDate && (
                <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{event.recurrenceCount}x</span>
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
          ) : editingField === 'time' ? (
            <input
              ref={inputRef}
              type="time"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="input event-inline-date"
            />
          ) : (
            <div className="event-date-line">
              <span
                onClick={() => startEdit('date', event.date)}
                title="Click to edit date"
                style={{ cursor: 'pointer' }}
              >
                {dateDisplay}
              </span>
              {event.time ? (
                <span
                  onClick={() => startEdit('time', event.time)}
                  title="Click to edit time"
                  style={{ cursor: 'pointer' }}
                >
                  {' · '}{formatTimeWithTz(event.time, event.timezone)}
                </span>
              ) : (
                <span
                  className="add-time-hint"
                  onClick={() => startEdit('time', '')}
                  title="Click to add time"
                >
                  {' + time'}
                </span>
              )}
            </div>
          )}

          {editingField === 'notes' ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleNotesKeyDown}
              className="input event-notes-textarea"
              rows={3}
              style={{ resize: 'none', marginTop: '4px', width: '100%', fontSize: '12px' }}
              placeholder="Add a note…"
              maxLength={500}
            />
          ) : event.notes ? (
            <div
              className={'event-notes' + (notesExpanded ? ' expanded' : '')}
              onClick={() => {
                if (notesExpanded) {
                  startEdit('notes', event.notes);
                } else {
                  setNotesExpanded(true);
                }
              }}
              title={notesExpanded ? 'Click to edit note' : 'Click to expand'}
              style={{
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: notesExpanded ? 'pre-wrap' : 'nowrap',
                textOverflow: notesExpanded ? 'unset' : 'ellipsis',
                lineHeight: '1.4',
              }}
            >
              {event.notes}
            </div>
          ) : (
            <div
              className="add-note-hint"
              onClick={() => startEdit('notes', '')}
              title="Add a note"
              style={{
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                opacity: 0,
              }}
            >
              + add note
            </div>
          )}
        </div>

        <div className="row-actions">
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); startEdit('name', event.name); }}
            title="Edit"
          >
            ✎
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Export to calendar"
            onClick={(e) => { e.stopPropagation(); exportSingleEvent({ ...event, id: event.id }, uid); }}
          >
            <Download size={14} />
          </button>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onDelete(event, e.shiftKey); }}
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
