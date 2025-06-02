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
const addButton = form.querySelector('button[type="submit"]');

let currentUser = null;

const QUICK_ADD_COOLDOWN_MS = 4000; // 4 seconds
let quickAddCooldown = false;


// Auth
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUser = user.uid;
    usernameDisplay.textContent = user.displayName || user.email;
    enterApp();
  } else {
    currentUser = null;
    usernameDisplay.textContent = '';
    exitApp();
  }
});

loginBtn.addEventListener('click', () => {
  firebase.auth().signInWithPopup(provider).catch(error => {
    alert('Login failed: ' + error.message);
  });
});

logoutBtn.addEventListener('click', () => {
  firebase.auth().signOut().catch(error => {
    alert('Logout failed: ' + error.message);
  });
});

async function enterApp() {
  authSection.classList.add('hidden');
  document.getElementById('titleRow').classList.remove('hidden');
  document.getElementById('userPanel').classList.remove('hidden');
  mainSection.classList.remove('hidden');
  form.style.display = 'flex';

  const userDoc = await db.collection('users').doc(currentUser).get();
  const quickAdd = userDoc.exists ? userDoc.data().quickAddMode : false;
  quickAddToggle.checked = quickAdd;
  dateInput.style.display = quickAdd ? 'none' : 'block';
  nameInput.placeholder = quickAdd ? "e.g. Dinner on July 9th" : "e.g. Dinner";

  loadEvents();
}


function exitApp() {
  authSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
  document.getElementById('titleRow').classList.add('hidden');
  form.style.display = 'none';
}

// Add event
form.addEventListener('submit', async e => {
  e.preventDefault();

  const isQuickAdd = quickAddToggle.checked;
  dateInput.style.display = isQuickAdd ? 'none' : 'block';

  const name = nameInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value.trim();
  const existingPopup = document.getElementById('formWarning');
  if (existingPopup) existingPopup.remove();

  if (isQuickAdd) {
    if (!name) return;

    if (quickAddCooldown) {
      const existing = document.getElementById('cooldownWarning');
      if (!existing) {
        const cooldownMsg = document.createElement('div');
        cooldownMsg.id = 'cooldownWarning';
        cooldownMsg.textContent = 'Please wait 4 seconds before adding another.';
        cooldownMsg.className = 'text-red-500 bg-black border border-red-500 rounded px-3 py-2 absolute bottom-20';
        form.appendChild(cooldownMsg);
        setTimeout(() => cooldownMsg.remove(), 1500);
      }
      return;
    }

    quickAddCooldown = true;
    setTimeout(() => {
      quickAddCooldown = false;
    }, QUICK_ADD_COOLDOWN_MS);

    try {
      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: name })
      });

      const data = await response.json();
      if (!data.name || !data.date) throw new Error("Incomplete data");

      await saveEvent(data.name, data.date, data.time || "");
      nameInput.value = '';
    } catch {
      const warning = document.createElement('div');
      warning.id = 'formWarning';
      warning.textContent = 'Could not understand. Try a clearer event and date.';
      warning.className = 'text-red-500 bg-black border border-red-500 rounded px-3 py-2 absolute bottom-20';
      form.appendChild(warning);
      setTimeout(() => warning.remove(), 1500);
    }
  }
  else {
    if (!name || !date) {
      const warning = document.createElement('div');
      warning.id = 'formWarning';
      warning.textContent = 'Please fill out both fields.';
      warning.className = 'text-red-500 bg-black border border-red-500 rounded px-3 py-2 absolute bottom-20';
      form.appendChild(warning);
      setTimeout(() => warning.remove(), 1500);
      return;
    }

    await saveEvent(name, date, time);
    form.reset();
  }
});



async function loadEvents() {
  if (!currentUser) return;
  const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
  const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  events.sort((a, b) => calculateDaysLeft(a.date) - calculateDaysLeft(b.date));
  eventsList.innerHTML = '';
  events.forEach(event => displayEvent(event));
}

async function saveEvent(name, date, time = "") {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').add({ name, date, time, owner: currentUser });
  loadEvents();
}

async function updateEventName(id, newName) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').doc(id).update({ name: newName });
  loadEvents();
}

async function updateEventDate(id, newDate) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').doc(id).update({ date: newDate });
  loadEvents();
}

async function deleteEvent(eventToDelete) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').doc(eventToDelete.id).delete();
  loadEvents();
}

function displayEvent(event) {
  const days = calculateDaysLeft(event.date);
  const fullDate = formatFullDate(event.date);

  const eventContainer = document.createElement('div');
  eventContainer.className = 'flex items-center gap-4 flex-wrap sm:flex-nowrap';

  const dateBox = document.createElement('div');
  dateBox.className = 'p-4 border rounded text-sm whitespace-nowrap cursor-pointer';
  dateBox.textContent = fullDate;

  dateBox.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = event.date;
    input.className = 'border rounded text-sm bg-black text-white w-[109px] h-[53px] text-center flex items-center justify-center';


    dateBox.replaceWith(input);
    input.focus();

    input.addEventListener('blur', async () => {
      const newDate = input.value;
      if (newDate && newDate !== event.date) {
        await updateEventDate(event.id, newDate);
      } else {
        loadEvents();
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
    });
  });

  const eventDiv = document.createElement('div');
  eventDiv.className = 'p-4 border rounded flex justify-between items-center flex-1 min-w-[200px]';

  const nameSpan = document.createElement('span');
  const bgColor = event.bgColor || 'yellow-300';
  nameSpan.className = `text-black bg-${bgColor} px-1 rounded cursor-pointer`;
  nameSpan.textContent = event.name;

  // Format time to 12-hour (if exists)
  let formattedTime = '';
  if (event.time) {
    const [hour, minute] = event.time.split(':');
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    formattedTime = `${h12}:${minute} ${ampm}`;
  }

  // Separate span for time (outside the colored box)
  const timeSpan = document.createElement('span');
  timeSpan.className = 'text-xs text-gray-400 ml-2';
  timeSpan.textContent = formattedTime;


  nameSpan.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = event.name;
    input.className = `text-black bg-${bgColor} px-1 rounded`;
    nameSpan.replaceWith(input);
    input.focus();

    input.addEventListener('blur', async () => {
      const newName = input.value.trim();
      if (newName && newName !== event.name) {
        await updateEventName(event.id, newName);
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

  const textDiv = document.createElement('div');
  textDiv.className = 'text-left break-words';
  const prefix = days < 0
    ? `happened ${Math.abs(days)} day(s) ago`
    : days === 0
      ? `is today`
      : `${days} day(s) until`;
  textDiv.appendChild(document.createTextNode(`${prefix} `));
  textDiv.appendChild(nameSpan);
  if (event.time) textDiv.appendChild(timeSpan);


  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'text-red-500 hover:underline ml-2 whitespace-nowrap';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    const confirmDelete = confirm(`Are you sure you want to delete "${event.name}"?`);
    if (confirmDelete) {
      deleteEvent(event);
    }
  });


  eventDiv.appendChild(textDiv);
  eventDiv.appendChild(deleteBtn);

  eventContainer.appendChild(dateBox);
  eventContainer.appendChild(eventDiv);

  eventsList.appendChild(eventContainer);
}

function calculateDaysLeft(dateStr) {
  const eventDate = new Date(dateStr);
  const now = new Date();
  return Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
}

function formatFullDate(dateStr) {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-GB', options);
}

// Color menu
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
      const classes = colorMenu.targetSpan.className.split(' ').filter(cls => !cls.startsWith('bg-'));
      colorMenu.targetSpan.className = [...classes, `bg-${color}`].join(' ');
      saveHighlightColor(colorMenu.targetId, color);
    }
    colorMenu.classList.add('hidden');
  });
  colorMenu.appendChild(option);
});
document.body.appendChild(colorMenu);
document.addEventListener('click', () => colorMenu.classList.add('hidden'));

async function saveHighlightColor(id, color) {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser).collection('events').doc(id).update({ bgColor: color });
}

// Export
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (!currentUser) return;

  const snapshot = await db.collection('users').doc(currentUser).collection('events').get();
  const events = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      name: data.name,
      date: data.date,
      time: data.time || "", // include time if present
      bgColor: data.bgColor || "yellow-300"
    };
  });

  const eventCount = events.length;

  const confirmed = confirm(`Are you sure you want to export your events?\nYou will download a JSON file with ${eventCount} event${eventCount !== 1 ? 's' : ''}.`);
  if (!confirmed) return;

  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentUser}_events.json`;
  a.click();
  URL.revokeObjectURL(url);
});



// Import .json
document.getElementById('importFile').addEventListener('change', async (e) => {
  if (!currentUser) return;
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  try {
    const importedEvents = JSON.parse(text);
    const batch = db.batch();
    const ref = db.collection('users').doc(currentUser).collection('events');

    importedEvents.forEach(event => {
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
    alert(`Imported ${importedEvents.length} events.`);
  } catch {
    alert("Invalid JSON.");
  }

  e.target.value = '';
});

// Import from .ics
document.getElementById('calendarFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentUser) return;

  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const events = [];
  let currentEvent = {};

  for (let line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      currentEvent = {};
    } else if (line.startsWith("SUMMARY:")) {
      currentEvent.name = line.slice(8).trim();
    } else if (line.startsWith("DTSTART;VALUE=DATE:")) {
      const rawDate = line.split(":")[1].trim();
      const formatted = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      currentEvent.date = formatted;
    } else if (line.startsWith("END:VEVENT")) {
      if (currentEvent.name && currentEvent.date) {
        const eventDate = new Date(currentEvent.date);
        const today = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(today.getFullYear() + 1);

        if (eventDate >= today && eventDate <= nextYear) {
          events.push(currentEvent);
        }
      }
    }
  }

  if (events.length === 0) {
    alert("No valid all-day events found.");
    return;
  }

  const batch = db.batch();
  const ref = db.collection('users').doc(currentUser).collection('events');

  events.forEach(event => {
    const doc = ref.doc();
    batch.set(doc, {
      name: event.name,
      date: event.date,
      bgColor: 'yellow-300',
      owner: currentUser
    });
  });

  await batch.commit();
  loadEvents();
  alert(`Imported ${events.length} calendar events.`);
  e.target.value = '';
});
const quickAddToggle = document.getElementById('quickAddToggle');
const nameInputField = document.getElementById('eventName');
const dateInputField = document.getElementById('eventDate');

quickAddToggle.addEventListener('change', () => {
  const isQuickAdd = quickAddToggle.checked;

  dateInput.style.display = isQuickAdd ? 'none' : 'block';

  nameInput.placeholder = isQuickAdd ? "e.g. Dinner on July 9th" : "e.g. Dinner";

  if (currentUser) {
    db.collection('users').doc(currentUser).set({
      quickAddMode: isQuickAdd
    }, { merge: true });
  }
});




async function parseWithGemini(input) {
  try {
    const res = await fetch('http://localhost:3000/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input })
    });
    const { name, date } = await res.json();
    return { name, date };
  } catch (err) {
    console.error('Gemini error:', err);
    return null;
  }
}
