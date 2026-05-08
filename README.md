# Days Until

A minimalist countdown app. Track dates that matter — events, deadlines, milestones.

Built with React 18, Vite, Firebase, Tailwind CSS, and Netlify Functions.

---

## Changelog

### v0.0.2
- Quick Add is now the only add mode — manual form removed
- Composer placeholder is LLM-generated per user context, refreshes on every page load
- Placeholders always include a date; optionally include time or color hint

### v0.0.1
- Initial release
- Event list with countdown days, color labels, and sort/filter
- Quick Add: describe events in plain language (Groq LLM parses date + time)
- Recurrence: daily, weekly, monthly, yearly with optional end date or count
- Count-up mode: track days since a past event with milestone alerts
- ICS import: parse .ics calendar files with duplicate detection
- ICS export: download individual events or all events as .ics
- Subscribed calendar feed: subscribe via URL in Google/Apple Calendar
- Push notifications: opt-in alerts 7 days, 1 day before, or day of
- Onboarding flow: guided setup for new users
- Default timezone setting (auto-detected)
- Data export/import (JSON)
- Auto-delete past events option
- Day of week display option
