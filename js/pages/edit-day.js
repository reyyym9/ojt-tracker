// EDIT DAY (edit-day.html?date=2026-11-03): change the times and note of one saved day.
import { $, setText, longDate, weekday, fmt } from '../util.js';
import { getDay, saveDay, hasDay, deleteDay } from '../store.js';
import { dayMin, validate, NOTES } from '../calc.js';
import { autosizeAll } from '../autosize.js';

const key = new URLSearchParams(location.search).get('date'); // the ?date=... part of the address
if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) location.replace('history.html');

const saved = getDay(key);
const whole = saved.mode === 'whole';
const value = id => $('#edit-' + id).value;

// Show the whole-day box or the morning/afternoon boxes, depending on how the day was logged
document.querySelectorAll('[data-mode-only]').forEach(box => { box.hidden = box.dataset.modeOnly !== saved.mode; });

if (whole) { $('#edit-day-in').value = saved.am.in || ''; $('#edit-day-out').value = saved.am.out || ''; }
else {
  $('#edit-am-in').value = saved.am.in || ''; $('#edit-am-out').value = saved.am.out || '';
  $('#edit-pm-in').value = saved.pm.in || ''; $('#edit-pm-out').value = saved.pm.out || '';
}
NOTES.forEach(([field]) => { $('#edit-' + field).value = saved[field] || ''; });
autosizeAll(); // fit the boxes to the saved text
setText('weekday', weekday(key));
setText('date', longDate(key).replace(/^\w+, /, '')); // "Tuesday, November 3, 2026" -> "November 3, 2026"

// Read the form back into a day object
function readForm() {
  const notes = Object.fromEntries(NOTES.map(([field]) => [field, value(field).trim()]));
  return whole
    ? { mode: 'whole', am: { in: value('day-in'), out: value('day-out') }, pm: {}, ...notes }
    : { mode: 'split', am: { in: value('am-in'), out: value('am-out') }, pm: { in: value('pm-in'), out: value('pm-out') }, ...notes };
}

// Update "hours worked" while typing
const showHours = () => setText('hours', fmt(dayMin(readForm())));
document.addEventListener('input', showHours);
showHours();

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const day = readForm(), error = validate(day);
  if (error) { alert(error); return; }
  saveDay(key, day);
  location.href = 'history.html';
});

// Delete: ask first, because this cannot be undone. Only shown for days that are actually saved.
$('#delete-btn').hidden = !hasDay(key);
$('#delete-btn').addEventListener('click', () => {
  if (confirm(`Delete the log for ${longDate(key)}? This cannot be undone.`)) {
    deleteDay(key);
    location.href = 'history.html';
  }
});
