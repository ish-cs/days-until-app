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

import EventItem from './EventItem.jsx';

const baseEvent = {
  id: 'evt1',
  name: 'Test Event',
  date: '2099-12-31',
  time: '',
  bgColor: 'yellow-300',
  recurrence: null,
  notes: null,
};

const baseProps = {
  event: baseEvent,
  uid: 'user1',
  showDayOfWeek: false,
  onDelete: vi.fn(),
  onColorChange: vi.fn(),
  showToast: vi.fn(),
  id: 'event-row-evt1',
  highlighted: false,
  colorPicker: null,
  onOpenColorPicker: vi.fn(),
  onCloseColorPicker: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventItem', () => {
  it('renders event name', () => {
    render(<EventItem {...baseProps} />);
    expect(screen.getByText('Test Event')).toBeInTheDocument();
  });

  it('shows input with event name value when name is clicked', async () => {
    const user = userEvent.setup();
    render(<EventItem {...baseProps} />);
    await user.click(screen.getByText('Test Event'));
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Test Event');
  });

  it('shows formatted time when time is present', () => {
    render(<EventItem {...baseProps} event={{ ...baseEvent, time: '14:30' }} />);
    expect(screen.getByText(/2:30 PM/)).toBeInTheDocument();
  });

  it('shows recurrence badge with ↻ when recurrence is set', () => {
    render(<EventItem {...baseProps} event={{ ...baseEvent, recurrence: 'weekly' }} />);
    expect(screen.getByText(/↻/)).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    render(<EventItem {...baseProps} event={{ ...baseEvent, notes: 'Some note text' }} />);
    expect(screen.getByText('Some note text')).toBeInTheDocument();
  });

  it('past event card has event-past class', () => {
    render(<EventItem {...baseProps} event={{ ...baseEvent, date: '2020-01-01' }} />);
    const card = document.querySelector('.event-card');
    expect(card).toHaveClass('event-past');
  });

  it('delete button exists', () => {
    render(<EventItem {...baseProps} />);
    expect(screen.getByTitle(/Delete/i)).toBeInTheDocument();
  });
});
