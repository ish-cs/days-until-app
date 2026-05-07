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
  settings: { quickAddMode: false },
  showToast: vi.fn(),
  composerPrefillDate: null,
  onComposerPrefillConsumed: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddEventForm', () => {
  it('renders name input with Event name placeholder', () => {
    render(<AddEventForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('Event name')).toBeInTheDocument();
  });

  it('renders date input in standard mode', () => {
    render(<AddEventForm {...defaultProps} />);
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('renders notes textarea', () => {
    render(<AddEventForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('Notes (optional)')).toBeInTheDocument();
  });

  it('quick add mode shows different placeholder', () => {
    render(<AddEventForm {...defaultProps} settings={{ quickAddMode: true }} />);
    expect(screen.getByPlaceholderText(/Add an event/i)).toBeInTheDocument();
  });

  it('submit without name shows toast with error message', async () => {
    const showToast = vi.fn();
    const user = userEvent.setup();
    render(<AddEventForm {...defaultProps} showToast={showToast} />);
    await user.click(screen.getByRole('button', { name: /Add/i }));
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('name'));
  });

  it.todo('pending event preview disappears on cancel — requires fetch mock returning parsed result');
});
