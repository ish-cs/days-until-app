import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../firebase.js', () => ({
  db: {},
  auth: {},
  googleProvider: {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../hooks/usePlaceholder.js', () => ({
  usePlaceholder: () => 'Add an event… e.g. Dentist next Tuesday 3pm',
}));

global.fetch = vi.fn();

import AddEventForm from './AddEventForm.jsx';

const defaultProps = {
  uid: 'user1',
  settings: {},
  showToast: vi.fn(),
  composerPrefillDate: null,
  onComposerPrefillConsumed: vi.fn(),
};

function stubGroqFetch() {
  global.fetch.mockImplementation(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'complete') {
      return { ok: true, json: async () => ({ suffix: '' }) };
    }
    return { ok: true, json: async () => ({ name: 'Dentist', date: '2026-05-10' }) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubGroqFetch();
});

describe('AddEventForm', () => {
  it('renders quick add placeholder', () => {
    render(<AddEventForm {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Add an event/i)).toBeInTheDocument();
  });

  it('does not render date or notes inputs', () => {
    render(<AddEventForm {...defaultProps} />);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.queryByPlaceholderText('Notes (optional)')).toBeNull();
  });

  it('renders Add button', () => {
    render(<AddEventForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
  });

  it('submit with empty input does nothing (no toast, no fetch)', async () => {
    const showToast = vi.fn();
    const user = userEvent.setup();
    render(<AddEventForm {...defaultProps} showToast={showToast} />);
    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect(showToast).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submit with text calls groq endpoint', async () => {
    const user = userEvent.setup();
    render(<AddEventForm {...defaultProps} />);
    await user.type(screen.getByRole('textbox'), 'Dentist next Tuesday');
    await user.click(screen.getByRole('button', { name: /Add/i }));
    const groqCalls = global.fetch.mock.calls.filter((c) => {
      try {
        const b = JSON.parse(c[1]?.body);
        return b.action !== 'complete';
      } catch {
        return true;
      }
    });
    expect(groqCalls.length).toBeGreaterThanOrEqual(1);
    expect(groqCalls.some(([url]) => url.includes('groq'))).toBe(true);
  });

  it('Tab accepts local wordfreq suggestion', async () => {
    const user = userEvent.setup();
    render(<AddEventForm {...defaultProps} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'tom');
    await waitFor(() => {
      const g = document.querySelector('.composer-input-mirror-ghost');
      expect(g?.textContent).toBe('orrow');
    }, { timeout: 5000 });
    await user.keyboard('{Tab}');
    expect(input).toHaveValue('tomorrow');
  });
});
