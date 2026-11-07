// HISTORY (history.html): every logged day, as a list or as a month calendar.
import { $, esc, fmt, parseKey, monthShort, weekday, longDate, keyOf, todayKey, mondayOf, addDays } from '../util.js';
import { getSettings, allDays } from '../store.js';
import { dayMin, lateMin, overtimeMin, dayStatus, isLogged, firstLoggedKey, weekNumber } from '../calc.js';

const settings = getSettings(), days = allDays();
const startKey = firstLoggedKey(days);                          // start of Week 1
const entries = Object.entries(days).filter(([, day]) => isLogged(day)).sort((a, b) => b[0].localeCompare(a[0])); // newest first

// ================= LIST VIEW =================
const row = ([key, day]) => {
  const late = lateMin(day, settings) > 0, overtime = overtimeMin(day, settings) > 0, status = dayStatus(day);
  return `
    <a class="day-item" href="edit-day.html?date=${key}">
      <div class="day-date"><span class="day-number">${parseKey(key).getDate()}</span><span class="day-month">${monthShort(key)}</span></div>
      <div class="day-info">
        <p class="day-weekday">${weekday(key)}${late ? ' <span class="tag tag-late">Late</span>' : ''}${overtime ? ' <span class="tag tag-over">Overtime</span>' : ''}${status === 'open' ? ' <span class="tag">In progress</span>' : ''}${status === 'needs-notes' ? ' <span class="tag tag-over">Needs notes</span>' : ''}${day.images.length ? ` <span class="tag">${day.images.length} photo${day.images.length > 1 ? 's' : ''}</span>` : ''}</p>
        <p class="day-note">${esc(day.tasks) || 'No notes yet'}</p>
      </div>
      <p class="day-hours">${status === 'open' ? 'Open' : fmt(dayMin(day))}</p>
    </a>`;
};

$('[data-bind="list"]').innerHTML = entries.length
  ? entries.map(row).join('')
  : '<p class="card card-note">No entries yet. Tap "+ Log today" on the Home page to add your first day.</p>';

// ================= CALENDAR VIEW =================
const STATUS_LABEL = { complete: 'Complete', open: 'In progress', 'needs-notes': 'Needs notes', 'needs-photo': 'Needs photo' };
const month = new Date(); month.setDate(1); // the month being shown (always the 1st)

function renderCalendar() {
  const year = month.getFullYear(), m = month.getMonth();
  const first = keyOf(new Date(year, m, 1)), last = keyOf(new Date(year, m + 1, 0));
  const title = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  let cells = '<span class="calendar-weekday">Wk</span>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="calendar-weekday">${d}</span>`).join('');
  for (let monday = mondayOf(first); monday <= last; monday = addDays(monday, 7)) { // one row per week
    const n = startKey ? weekNumber(monday, startKey) : 0;
    cells += `<span class="calendar-week">${n >= 1 ? n : ''}</span>`;
    for (let i = 0; i < 7; i++) {
      const key = addDays(monday, i);
      if (key < first || key > last) { cells += '<span class="calendar-cell"></span>'; continue; } // day of another month
      const day = days[key], number = parseKey(key).getDate(), today = key === todayKey() ? ' calendar-today' : '';
      if (day && isLogged(day)) { // logged: a link to edit it
        const status = dayStatus(day) === 'empty' ? 'open' : dayStatus(day);
        cells += `<a class="calendar-cell calendar-day calendar-day-${status}${today}" href="edit-day.html?date=${key}" aria-label="${longDate(key)}, ${STATUS_LABEL[status]}">${number}</a>`;
      } else {      // not logged: plain text, nothing happens when tapped
        cells += `<span class="calendar-cell calendar-day${today}">${number}</span>`;
      }
    }
  }
  $('[data-bind="calendar"]').innerHTML = `
    <div class="calendar-header">
      <button class="btn-icon" type="button" data-month="-1" aria-label="Previous month">&lsaquo;</button>
      <h2 class="calendar-title">${title}</h2>
      <button class="btn-icon" type="button" data-month="1" aria-label="Next month">&rsaquo;</button>
    </div>
    <div class="calendar-grid">${cells}</div>
    <div class="calendar-legend">
      <span><span class="legend-dot calendar-day-complete"></span>Complete</span>
      <span><span class="legend-dot calendar-day-open"></span>In progress</span>
      <span><span class="legend-dot calendar-day-needs-notes"></span>Needs notes</span>
    </div>
    <p class="card-note">Tap a colored date to edit it. "Wk" is your OJT week number.</p>`;
}

// ================= SWITCHING BETWEEN THE TWO =================
const ICONS = {
  calendar: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  list: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
};
const VIEW_KEY = 'ojt-diy-history-view'; // remembers the last view you used
let view = 'list';
try { if (localStorage.getItem(VIEW_KEY) === 'calendar') view = 'calendar'; } catch (e) {}

function showView() {
  const calendar = view === 'calendar';
  $('[data-bind="list"]').hidden = calendar;
  $('[data-bind="calendar"]').hidden = !calendar;
  $('#view-toggle').innerHTML = calendar ? ICONS.list : ICONS.calendar; // the icon shows what you will switch TO
  $('#view-toggle').setAttribute('aria-label', calendar ? 'Show list' : 'Show calendar');
  if (calendar) renderCalendar();
}

document.addEventListener('click', e => {
  if (e.target.closest('#view-toggle')) {
    view = view === 'list' ? 'calendar' : 'list';
    try { localStorage.setItem(VIEW_KEY, view); } catch (err) {}
    showView();
  }
  const step = e.target.closest('[data-month]');
  if (step) { month.setMonth(month.getMonth() + Number(step.dataset.month)); renderCalendar(); }
});

showView();
