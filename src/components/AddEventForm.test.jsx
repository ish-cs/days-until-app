import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

global.fetch = vi.fn();

import AddEventForm from './AddEventForm.jsx';

const defaultProps = {
  uid: 'user1',
  settings: {},
  showToast: vi.fn(),
  composerPrefillDate: null,
  onComposerPrefillConsumed: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
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
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Dentist', date: '2026-05-10' }),
    });
    const user = userEvent.setup();
    render(<AddEventForm {...defaultProps} />);
    await user.type(screen.getByRole('textbox'), 'Dentist next Tuesday');
    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/groq', expect.any(Object));
  });
});
