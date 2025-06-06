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
const userEmailDisplay = document.getElementById('userEmailDisplay'); // Added reference for email display


let currentUser = null;
const QUICK_ADD_COOLDOWN_MS = 4000;
let quickAddCooldown = false;

// === Auth State Handling ===
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    currentUser = user.uid;
    usernameDisplay.textContent = user.displayName || user.email;
    userEmailDisplay.textContent = user.email; // Set user email in settings
    await showMainUI();
  } else {
    currentUser = null;
    usernameDisplay.textContent = '';
    userEmailDisplay.textContent = ''; // Clear user email on logout
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
function updateFormMode(isQuickAdd) {
  dateInput.style.display = isQuickAdd ? 'none' : 'block';
  timeInput.style.display = isQuickAdd ? 'none' : 'block';
  nameInput.placeholder = isQuickAdd
    ? "e.g. Dinner on July 9th at 9:45 PM (add 'red' for red highlight)"
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
/**
 * Displays a temporary warning/success message at the bottom of the form.
 * @param {string} id - Unique ID for the warning element.
 * @param {string} message - The message to display.
 * @param {string} classes - Tailwind CSS classes for styling (e.g., 'text-green-500 border-green-500').
 * @param {number} timeout - Duration in ms before the message disappears (0 for no auto-hide).
 */
function showWarning(id, message, classes = 'text-red-500 border-red-500', timeout = 1500) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const warning = createEl('div', `bg-black border rounded px-3 py-2 absolute bottom-20 ${classes}`, message);
  warning.id = id;
  form.appendChild(warning);
  
  if (timeout > 0) {
    setTimeout(() => warning.remove(), timeout);
  }
}

/**
 * Displays a modal confirmation dialog.
 * @param {string} id - Unique ID for the modal overlay.
 * @param {string} message - The message to display in the modal.
 * @param {Function} onConfirm - Callback function if user confirms.
 * @param {Function} onCancel - Callback function if user cancels.
 */
function showModalConfirmation(id, message, onConfirm, onCancel) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const modalOverlay = createEl('div', 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]');
  modalOverlay.id = id;

  const modalContent = createEl('div', 'bg-black border border-gray-700 rounded-lg p-6 w-full max-w-sm flex flex-col items-center gap-4');
  const messageText = createEl('p', 'text-white text-center', message);
  const buttonContainer = createEl('div', 'flex gap-4 mt-4');

  // Applying 'subtle-btn' class and retaining specific colors/hovers
  const confirmButton = createEl('button', 'subtle-btn text-left w-full border-red-600 hover:bg-red-900', 'Confirm');
  confirmButton.onclick = () => {
    cleanupKeyboardListener();
    onConfirm();
    modalOverlay.remove();
  };

  const cancelButton = createEl('button', 'subtle-btn text-left w-full cursor-pointer', 'Cancel');
  cancelButton.onclick = () => {
    cleanupKeyboardListener();
    onCancel();
    modalOverlay.remove();
  };

  buttonContainer.append(confirmButton, cancelButton);
  modalContent.append(messageText, buttonContainer);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  const keyboardListener = (e) => {
    if (e.key === 'Enter') {
      confirmButton.click();
    } else if (e.key === 'Escape') {
      cancelButton.click();
    }
  };

  const cleanupKeyboardListener = () => {
    document.removeEventListener('keydown', keyboardListener);
  };

  document.addEventListener('keydown', keyboardListener);
}

/**
 * Helper function to create a DOM element with classes and text content.
 * @param {string} tag - The HTML tag name (e.g., 'div', 'span', 'button').
 * @param {string} [classes=''] - Optional CSS classes to apply.
 * @param {string} [text=''] - Optional text content for the element.
 * @returns {HTMLElement} The created DOM element.
 */
function createEl(tag, classes = '', text = '') {
  const el = document.createElement(tag);
  if (classes) el.className = classes;
  if (text) el.textContent = text;
  return el;
}

/**
 * Makes a display element editable by replacing it with an input field.
 * @param {HTMLElement} displayElement - The element currently displaying the value.
 * @param {string} initialValue - The current value to put in the input.
 * @param {string} inputType - The type of input ('text' or 'date').
 * @param {string} inputClasses - CSS classes for the input field.
 * @param {Function} onUpdate - Callback function when the value is updated.
 * @param {any} id - The ID of the event being edited.
 */
function makeEditable(displayElement, initialValue, inputType, inputClasses, onUpdate, id) {
  const input = createEl('input', inputClasses);
  input.type = inputType;
  input.value = initialValue;

  // Match dimensions for seamless transition
  const originalWidth = displayElement.offsetWidth;
  const originalHeight = displayElement.offsetHeight;
  input.style.width = `${originalWidth}px`;
  input.style.height = `${originalHeight}px`;

  displayElement.replaceWith(input);
  input.focus();

  const handleBlur = () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== initialValue) {
      onUpdate(id, newValue);
    } else {
      loadEvents(); // Revert by reloading if no change or invalid
    }
    input.removeEventListener('blur', handleBlur);
    input.removeEventListener('keydown', handleKeyDown);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    }
  };

  input.addEventListener('blur', handleBlur);
  input.addEventListener('keydown', handleKeyDown);
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
    await handleQuickAddSubmission(name);
  } else {
    if (!name || !date) {
      showWarning('formWarning', 'Please fill out both fields.');
      return;
    }
    await saveEvent(name, date, time, 'yellow-300');
    form.reset();
  }
});

/**
 * Handles the submission logic for Quick Add Mode.
 * @param {string} userInput - The raw text input from the user.
 */
async function handleQuickAddSubmission(userInput) {
  if (!userInput) return;

  if (quickAddCooldown) {
    showWarning('cooldownWarning', 'Please wait 4 seconds before adding another.');
    return;
  }

  quickAddCooldown = true;
  setTimeout(() => (quickAddCooldown = false), QUICK_ADD_COOLDOWN_MS);

  try {
    const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
    const allEvents = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: userInput, context: allEvents })
    });

    const data = await response.json();
    const eventColor = data.color || 'yellow-300'; 

    if (!data.name || !data.date) throw new Error();

    await saveEvent(data.name, data.date, data.time || '', eventColor);
    nameInput.value = '';
  } catch (err) {
    console.error("Gemini call failed:", err);
    showWarning('formWarning', 'Could not understand. Try a clearer event and date.');
  }
}

// === Firestore Event Functions ===
async function saveEvent(name, date, time = "", bgColor = "yellow-300") {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').add({
    name, date, time, bgColor, owner: currentUser
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
    `deleteSingleConfirm-${eventToDelete.id}`,
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

  const container = createEl('div', 'flex items-center gap-4 flex-wrap sm:flex-nowrap');

  // --- DATE BOX ---
  const dateBox = createEl('div', 'p-4 border rounded text-sm whitespace-nowrap cursor-pointer', fullDate);
  dateBox.addEventListener('click', () => {
    makeEditable(dateBox, event.date, 'date', 'border rounded text-sm bg-black text-white p-4 text-center', updateEventDate, event.id);
  });

  // --- EVENT NAME + TIME ---
  // Added truncation classes and inline-block for proper max-width behavior
  const nameSpan = createEl('span', `text-black bg-${bgColor} px-1 rounded cursor-pointer inline-block overflow-hidden whitespace-nowrap text-ellipsis max-w-60 flex-shrink`); 
  nameSpan.textContent = event.name;

  const timeSpan = createEl('span', 'text-xs text-gray-400 ml-2 flex-shrink-0'); // Ensure time does not shrink
  if (event.time) {
    const [h, m] = event.time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    timeSpan.textContent = `${h12}:${m} ${ampm}`;
  }

  nameSpan.addEventListener('click', () => {
    // Temporarily remove truncation classes when editing
    nameSpan.classList.remove('inline-block', 'overflow-hidden', 'whitespace-nowrap', 'text-ellipsis', 'max-w-60', 'flex-shrink'); 
    makeEditable(nameSpan, event.name, 'text', `text-black bg-${bgColor} px-1 rounded w-fit`, updateEventName, event.id);
  });

  nameSpan.addEventListener('contextmenu', e => {
    e.preventDefault();
    colorMenu.style.left = `${e.pageX}px`;
    colorMenu.style.top = `${e.pageY}px`;
    colorMenu.classList.remove('hidden');
    colorMenu.targetSpan = nameSpan;
    colorMenu.targetId = event.id;
  });

  // Define prefix string here
  const prefix = days < 0 ? `happened ${-days} day(s) ago`
              : days === 0 ? `is today`
              : `${days} day(s) until`;

  const textContentContainer = createEl('div', 'text-left flex items-baseline overflow-hidden'); 
  // Added 'mr-1' (margin-right: 0.25rem) to prefixSpan to add space
  const prefixSpan = createEl('span', 'flex-shrink-0 mr-1', `${prefix}`); 

  textContentContainer.append(prefixSpan, nameSpan);
  if (event.time) textContentContainer.append(timeSpan);

  // --- DELETE BUTTON ---
  const delBtn = createEl('button', 'text-red-500 hover:underline ml-2 whitespace-nowrap', 'Delete');
  delBtn.addEventListener('click', () => {
    deleteEvent(event);
  });

  const eventBox = createEl('div', 'p-4 border rounded flex justify-between items-center flex-1 min-w-[200px]');
  eventBox.append(textContentContainer, delBtn); // Use the new container here

  container.append(dateBox, eventBox);
  eventsList.appendChild(container);
}

// === Color Menu ===
const colorMenu = createEl('div', 'fixed bg-black border border-gray-600 p-2 rounded hidden z-50');
colorMenu.id = 'colorMenu';

const bgColors = [
  'yellow-300', 'red-300', 'green-300', 'blue-300', 'purple-300',
  'pink-300', 'orange-300', 'teal-300', 'gray-300', 'white'
];

bgColors.forEach(color => {
  const option = createEl('div', `cursor-pointer mb-1 last:mb-0 text-sm px-2 py-1 rounded bg-${color}`);
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

    const a = createEl('a');
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