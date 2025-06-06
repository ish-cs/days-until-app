// === Firebase Initialization ===
const firebaseConfig = {
  apiKey: "AIzaSyAewNRpYxsT7D-c2yE6PvR52YaBkZGOfN4",
  authDomain: "daysuntil-c8909.firebaseapp.com",
  projectId: "daysuntil-c8909",
  messagingSenderId: "850249417315",
  appId: "1:850249417315:web:de7fb067dbf7df28c3ae56",
  measurementId: "G-7Q7EBH5C0J"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// === DOM References ===
const loginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('authSection');
const mainSection = document.getElementById('mainSection');
const form = document.getElementById('eventForm');
const nameInput = document.getElementById('eventName');
const dateInput = document.getElementById('eventDate');
const timeInput = document.getElementById('eventTime');
const eventsList = document.getElementById('eventsList');
const usernameDisplay = document.getElementById('usernameDisplay');
const quickAddToggle = document.getElementById('quickAddToggle');
const addButton = form.querySelector('button[type="submit"]');

// Settings Menu DOM References
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const autoDeleteToggle = document.getElementById('autoDeleteToggle');
const deleteAllEventsBtn = document.getElementById('deleteAllEventsBtn');


let currentUser = null;
const QUICK_ADD_COOLDOWN_MS = 4000;
let quickAddCooldown = false;

// === Auth State Handling ===
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    currentUser = user.uid;
    usernameDisplay.textContent = user.displayName || user.email;
    await showMainUI();
  } else {
    currentUser = null;
    usernameDisplay.textContent = '';
    showLoginUI();
  }
});

loginBtn.addEventListener('click', () => {
  firebase.auth().signInWithPopup(provider).catch(err => {
    showWarning('loginWarning', 'Login failed: ' + err.message);
    console.error('Login failed: ' + err.message);
  });
});

logoutBtn.addEventListener('click', () => {
  firebase.auth().signOut().catch(err => {
    showWarning('logoutWarning', 'Logout failed: ' + err.message);
    console.error('Logout failed: ' + err.message);
  });
});

// === Settings Menu Handlers ===
settingsBtn.addEventListener('click', () => {
  settingsMenu.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsMenu.classList.add('hidden');
});

// Close menu when clicking outside the modal content
settingsMenu.addEventListener('click', (e) => {
    if (e.target.id === 'settingsMenu') {
        settingsMenu.classList.add('hidden');
    }
});


// === UI Mode Switching ===
// Moved updateFormMode here so it's defined before showMainUI calls it
function updateFormMode(isQuickAdd) {
  dateInput.style.display = isQuickAdd ? 'none' : 'block';
  timeInput.style.display = isQuickAdd ? 'none' : 'block';
  nameInput.placeholder = isQuickAdd
    ? "e.g. Dinner on July 9th at 9:45 PM"
    : "e.g. Dinner";
}

async function showMainUI() {
  authSection.classList.add('hidden');
  document.getElementById('titleRow').classList.remove('hidden');
  document.getElementById('userPanel').classList.remove('hidden');
  mainSection.classList.remove('hidden');
  form.style.display = 'flex';

  const userDoc = await db.collection('users').doc(currentUser).get();
  const quickAdd = userDoc.exists ? userDoc.data().quickAddMode : false;
  quickAddToggle.checked = quickAdd;

  const autoDelete = userDoc.exists ? userDoc.data().autoDeleteMode : false;
  autoDeleteToggle.checked = autoDelete;

  updateFormMode(quickAdd);
  loadEvents();
}

function showLoginUI() {
  authSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
  document.getElementById('titleRow').classList.add('hidden');
  form.style.display = 'none';
  settingsMenu.classList.add('hidden');
}

// === UI Helpers ===
// Modified showWarning to correctly apply color and border
function showWarning(id, message, classes = 'text-red-500 border-red-500', timeout = 1500) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const warning = document.createElement('div');
  warning.id = id;
  warning.textContent = message;
  // Base styling for common properties, then apply the specific color and border
  warning.className = `bg-black border rounded px-3 py-2 absolute bottom-20 ${classes}`;
  form.appendChild(warning);
  
  if (timeout > 0) {
    setTimeout(() => warning.remove(), timeout);
  }
}

// New function for modal confirmations with keyboard support
function showModalConfirmation(id, message, onConfirm, onCancel) {
  const existing = document.getElementById(id);
  if (existing) existing.remove(); // Remove any existing confirmation

  const modalOverlay = document.createElement('div');
  modalOverlay.id = id;
  modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]'; // Higher z-index

  const modalContent = document.createElement('div');
  modalContent.className = 'bg-black border border-gray-700 rounded-lg p-6 w-full max-w-sm flex flex-col items-center gap-4';

  const messageText = document.createElement('p');
  messageText.textContent = message;
  messageText.className = 'text-white text-center';

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-4 mt-4';

  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Confirm';
  confirmButton.className = 'px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700';
  confirmButton.onclick = () => {
    cleanupKeyboardListener(); // Remove listener before closing
    onConfirm();
    modalOverlay.remove();
  };

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700';
  cancelButton.onclick = () => {
    cleanupKeyboardListener(); // Remove listener before closing
    onCancel();
    modalOverlay.remove();
  };

  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);
  modalContent.appendChild(messageText);
  modalContent.appendChild(buttonContainer);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay); // Append to body to ensure it's on top

  // Add keyboard listener for Enter/Escape
  const keyboardListener = (e) => {
    if (e.key === 'Enter') {
      confirmButton.click(); // Simulate click on confirm
    } else if (e.key === 'Escape') {
      cancelButton.click(); // Simulate click on cancel
    }
  };

  // Function to remove the keyboard listener
  const cleanupKeyboardListener = () => {
    document.removeEventListener('keydown', keyboardListener);
  };

  document.addEventListener('keydown', keyboardListener);
}


// === Form Submission Handler ===
form.addEventListener('submit', async e => {
  e.preventDefault();

  const isQuickAdd = quickAddToggle.checked;
  updateFormMode(isQuickAdd);

  const name = nameInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value.trim();

  if (isQuickAdd) {
    if (!name) return;

    if (quickAddCooldown) {
      showWarning('cooldownWarning', 'Please wait 4 seconds before adding another.');
      return;
    }

    quickAddCooldown = true;
    setTimeout(() => (quickAddCooldown = false), QUICK_ADD_COOLDOWN_MS);

    try {
      const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
      const allEvents = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})); // Include ID for context
      
      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: name, context: allEvents })
      });

      const data = await response.json();
      if (!data.name || !data.date) throw new Error();

      await saveEvent(data.name, data.date, data.time || '');
      nameInput.value = '';
    } catch (err) {
      console.error("Gemini call failed:", err); // Log the actual error
      showWarning('formWarning', 'Could not understand. Try a clearer event and date.');
    }
  } else {
    if (!name || !date) {
      showWarning('formWarning', 'Please fill out both fields.');
      return;
    }

    await saveEvent(name, date, time);
    form.reset();
  }
});

// === Firestore Event Functions ===
async function saveEvent(name, date, time = "") {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').add({
    name, date, time, owner: currentUser
  });
  loadEvents();
}

async function loadEvents() {
  if (!currentUser) return;
  const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
  let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const userDoc = await db.collection('users').doc(currentUser).get();
  const autoDelete = userDoc.exists ? userDoc.data().autoDeleteMode : false;

  if (autoDelete) {
    const batch = db.batch();
    const filteredEvents = [];
    events.forEach(event => {
      if (calculateDaysLeft(event.date) < 0) {
        batch.delete(db.collection('users').doc(currentUser).collection('events').doc(event.id));
      } else {
        filteredEvents.push(event);
      }
    });
    await batch.commit();
    events = filteredEvents;
  }

  events.sort((a, b) => calculateDaysLeft(a.date) - calculateDaysLeft(b.date));
  eventsList.innerHTML = '';
  events.forEach(event => displayEvent(event));
}

async function updateEventName(id, newName) {
  if (!currentUser || !newName) return;
  await db.collection('users').doc(currentUser).collection('events').doc(id).update({ name: newName });
  loadEvents();
}

async function updateEventDate(id, newDate) {
  if (!currentUser || !newDate) return;
  await db.collection('users').doc(currentUser).collection('events').doc(id).update({ date: newDate });
  loadEvents();
}

async function deleteEvent(eventToDelete) {
  if (!currentUser || !eventToDelete?.id) return;

  showModalConfirmation(
    `deleteSingleConfirm-${eventToDelete.id}`, // Unique ID for each event's confirmation
    `Are you sure you want to delete "${eventToDelete.name}"? This cannot be undone.`,
    async () => {
      try {
        await db.collection('users').doc(currentUser).collection('events').doc(eventToDelete.id).delete();
        loadEvents();
        showWarning('deleteSingleSuccess', `Event "${eventToDelete.name}" deleted successfully!`, 'text-green-500 border-green-500');
        console.log(`Event "${eventToDelete.name}" deleted.`);
      } catch (err) {
        showWarning('deleteSingleError', `Failed to delete event "${eventToDelete.name}".`, 'text-red-500 border-red-500');
        console.error(`Failed to delete event "${eventToDelete.name}":`, err);
      }
    },
    () => {
      console.log(`Deletion of "${eventToDelete.name}" cancelled.`);
    }
  );
}

// === Utility Functions ===
function calculateDaysLeft(dateStr) {
  const eventDate = new Date(dateStr);
  const now = new Date();
  eventDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// === Display Event ===
function displayEvent(event) {
  const days = calculateDaysLeft(event.date);
  const fullDate = formatFullDate(event.date);
  const bgColor = event.bgColor || 'yellow-300';

  const container = document.createElement('div');
  container.className = 'flex items-center gap-4 flex-wrap sm:flex-nowrap';

  // --- DATE BOX ---
  const dateBox = document.createElement('div');
  dateBox.className = 'p-4 border rounded text-sm whitespace-nowrap cursor-pointer';
  dateBox.textContent = fullDate;

  dateBox.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = event.date;

    const originalWidth = dateBox.offsetWidth;
    const originalHeight = dateBox.offsetHeight;

    input.className = 'border rounded text-sm bg-black text-white p-4 text-center';
    input.style.width = `${originalWidth}px`;
    input.style.height = `${originalHeight}px`;

    dateBox.replaceWith(input);
    input.focus();

    input.addEventListener('blur', () => {
      const newDate = input.value;
      if (newDate && newDate !== event.date) {
        updateEventDate(event.id, newDate);
      } else {
        loadEvents();
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
    });
  });

  // --- EVENT NAME + TIME ---
  const nameSpan = document.createElement('span');
  nameSpan.className = `text-black bg-${bgColor} px-1 rounded cursor-pointer`;
  nameSpan.textContent = event.name;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'text-xs text-gray-400 ml-2';
  if (event.time) {
    const [h, m] = event.time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    timeSpan.textContent = `${h12}:${m} ${ampm}`;
  }

  nameSpan.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = event.name;
    input.className = `text-black bg-${bgColor} px-1 rounded`;
    nameSpan.replaceWith(input);
    input.focus();

    input.addEventListener('blur', () => {
      const newName = input.value.trim();
      if (newName && newName !== event.name) {
        updateEventName(event.id, newName);
      } else {
        loadEvents();
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
    });
  });

  nameSpan.addEventListener('contextmenu', e => {
    e.preventDefault();
    colorMenu.style.left = `${e.pageX}px`;
    colorMenu.style.top = `${e.pageY}px`;
    colorMenu.classList.remove('hidden');
    colorMenu.targetSpan = nameSpan;
    colorMenu.targetId = event.id;
  });

  const text = document.createElement('div');
  text.className = 'text-left break-words';
  const prefix = days < 0 ? `happened ${-days} day(s) ago`
              : days === 0 ? `is today`
              : `${days} day(s) until`;
  text.append(`${prefix} `);
  text.append(nameSpan);
  if (event.time) text.append(timeSpan);

  // --- DELETE BUTTON ---
  const delBtn = document.createElement('button');
  delBtn.className = 'text-red-500 hover:underline ml-2 whitespace-nowrap';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => {
    deleteEvent(event); // Call the main deleteEvent function
  });

  const eventBox = document.createElement('div');
  eventBox.className = 'p-4 border rounded flex justify-between items-center flex-1 min-w-[200px]';
  eventBox.appendChild(text);
  eventBox.appendChild(delBtn);

  container.appendChild(dateBox);
  container.appendChild(eventBox);
  eventsList.appendChild(container);
}

// === Color Menu ===
const colorMenu = document.createElement('div');
colorMenu.id = 'colorMenu';
colorMenu.className = 'fixed bg-black border border-gray-600 p-2 rounded hidden z-50';

const bgColors = [
  'yellow-300', 'red-300', 'green-300', 'blue-300', 'purple-300',
  'pink-300', 'orange-300', 'teal-300', 'gray-300', 'white'
];

bgColors.forEach(color => {
  const option = document.createElement('div');
  option.className = `cursor-pointer mb-1 last:mb-0 text-sm px-2 py-1 rounded bg-${color}`;
  option.addEventListener('click', () => {
    if (colorMenu.targetSpan) {
      const clean = colorMenu.targetSpan.className.split(' ').filter(c => !c.startsWith('bg-'));
      colorMenu.targetSpan.className = [...clean, `bg-${color}`].join(' ');
      saveHighlightColor(colorMenu.targetId, color);
    }
    colorMenu.classList.add('hidden');
  });
  colorMenu.appendChild(option);
});

document.body.appendChild(colorMenu);
document.addEventListener('click', (e) => {
  if (!colorMenu.contains(e.target) && e.target !== colorMenu.targetSpan) {
    colorMenu.classList.add('hidden');
  }
});


async function saveHighlightColor(id, color) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').doc(id).update({ bgColor: color });
}

// === Quick Add Toggle Save ===
quickAddToggle.addEventListener('change', () => {
  const isQuick = quickAddToggle.checked;
  updateFormMode(isQuick);

  if (currentUser) {
    db.collection('users').doc(currentUser).set({ quickAddMode: isQuick }, { merge: true });
  }
});

// Auto-Delete Toggle Save
autoDeleteToggle.addEventListener('change', async () => {
  const isAutoDelete = autoDeleteToggle.checked;
  if (currentUser) {
    await db.collection('users').doc(currentUser).set({ autoDeleteMode: isAutoDelete }, { merge: true });
    loadEvents();
  }
});


// === EXPORT to JSON ===
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (!currentUser) return;

  try {
    const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.name,
        date: data.date,
        time: data.time || "",
        bgColor: data.bgColor || "yellow-300"
      };
    });

    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentUser}_events.json`;
    a.click();
    URL.revokeObjectURL(url);
    showWarning('exportSuccess', 'Events exported successfully!', 'text-green-500 border-green-500');
  } catch (err) {
    showWarning('exportError', 'Failed to export events.', 'text-red-500 border-red-500');
    console.error('Export failed:', err);
  }
});

// === IMPORT from .json ===
document.getElementById('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    const ref = db.collection('users').doc(currentUser).collection('events');
    const batch = db.batch();

    imported.forEach(event => {
      const doc = ref.doc();
      batch.set(doc, {
        name: event.name || "Unnamed Event",
        date: event.date || new Date().toISOString().slice(0, 10),
        time: event.time || "",
        bgColor: event.bgColor || 'yellow-300',
        owner: currentUser
      });
    });

    await batch.commit();
    loadEvents();
    showWarning('importSuccess', `Imported ${imported.length} events.`, 'text-green-500 border-green-500');
  } catch (err) {
    showWarning('importError', 'Invalid JSON file or import failed.', 'text-red-500 border-red-500');
    console.error('Invalid JSON file or import failed:', err);
  }

  e.target.value = '';
});

// === IMPORT from .ics ===
document.getElementById('calendarFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const events = [];
    let current = {};

    for (let line of lines) {
      if (line.startsWith("BEGIN:VEVENT")) current = {};
      else if (line.startsWith("SUMMARY:")) current.name = line.slice(8).trim();
      else if (line.startsWith("DTSTART;VALUE=DATE:")) {
        const raw = line.split(":")[1].trim();
        current.date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      } else if (line.startsWith("END:VEVENT") && current.name && current.date) {
        const eventDate = new Date(current.date);
        const today = new Date();
        const yearAhead = new Date(); yearAhead.setFullYear(today.getFullYear() + 1);
        if (eventDate >= today && eventDate <= yearAhead) {
          events.push(current);
        }
      }
    }

    const ref = db.collection('users').doc(currentUser).collection('events');
    const batch = db.batch();
    events.forEach(event => {
      const doc = ref.doc();
      batch.set(doc, {
        name: event.name,
        date: event.date,
        time: "",
        bgColor: 'yellow-300',
        owner: currentUser
      });
    });

    await batch.commit();
    loadEvents();
    showWarning('icsImportSuccess', `Imported ${events.length} calendar events.`, 'text-green-500 border-green-500');
  } catch (err) {
    showWarning('icsImportError', 'Invalid ICS file or import failed.', 'text-red-500 border-red-500');
    console.error('Invalid ICS file or import failed:', err);
  }

  e.target.value = '';
});

// === Delete All Events ===
deleteAllEventsBtn.addEventListener('click', async () => {
  if (!currentUser) return;

  showModalConfirmation(
    'deleteAllConfirm',
    'Are you sure you want to delete ALL events? This cannot be undone.',
    async () => {
      try {
        const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        loadEvents();
        showWarning('deleteAllSuccess', 'All events deleted successfully!', 'text-green-500 border-green-500');
        console.log('All events deleted.');
      } catch (err) {
        showWarning('deleteAllError', 'Failed to delete all events.', 'text-red-500 border-red-500');
        console.error('Failed to delete all events:', err);
      }
    },
    () => {
      console.log('Delete all events cancelled.');
    }
  );
});