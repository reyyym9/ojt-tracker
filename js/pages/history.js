// HISTORY (history.html): list every logged day, newest first.
import { $, esc, fmt, parseKey, monthShort, weekday } from '../util.js';
import { getSettings, allDays } from '../store.js';
import { dayMin, lateMin, overtimeMin, dayStatus } from '../calc.js';

const settings = getSettings();

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

const entries = Object.entries(allDays())
  .filter(([, day]) => dayStatus(day) !== 'empty' || day.tasks.trim())
  .sort((a, b) => b[0].localeCompare(a[0])); // newest first ("2026-11-03" sorts correctly as text)

$('[data-bind="list"]').innerHTML = entries.length
  ? entries.map(row).join('')
  : '<p class="card card-note">No entries yet. Tap "+ Log today" on the Home page to add your first day.</p>';
