import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications.js';

const LEAD_DAY_OPTIONS = [
  { value: 7, label: '7 days before' },
  { value: 1, label: '1 day before' },
  { value: 0, label: 'Day of' },
];

export default function NotificationSettings({ uid, settings, updateSettings }) {
  const { isSupported, isEnabled, permission, requestPermission, unsubscribe } = usePushNotifications(uid);

  if (!isSupported) return null;

  async function handleToggle(e) {
    if (e.target.checked) {
      await requestPermission();
      updateSettings({ notificationsEnabled: true });
    } else {
      await unsubscribe();
      updateSettings({ notificationsEnabled: false });
    }
  }

  function handleLeadDay(day, checked) {
    const current = settings.notificationLeadDays ?? [7, 1, 0];
    const updated = checked ? [...new Set([...current, day])] : current.filter(d => d !== day);
    updateSettings({ notificationLeadDays: updated.sort((a, b) => b - a) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="settings-toggle">
        <div className="settings-toggle-body">
          <div className="settings-toggle-title">Event reminders</div>
          <div className="settings-toggle-desc">
            {permission === 'denied'
              ? 'Notifications blocked — enable in browser settings.'
              : 'Get notified before upcoming events.'}
          </div>
        </div>
        <input
          type="checkbox"
          checked={isEnabled && settings.notificationsEnabled}
          disabled={permission === 'denied'}
          onChange={handleToggle}
        />
      </label>

      {isEnabled && settings.notificationsEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
          {LEAD_DAY_OPTIONS.map(({ value, label }) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(settings.notificationLeadDays ?? [7, 1, 0]).includes(value)}
                onChange={e => handleLeadDay(value, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
