// REPORTS (reports.html, the Report tab): one row per week that has logs, newest first.
// Tap a week: its saved report opens right away; if there is none yet, it asks first and generates it.
import { $, fmt, todayKey, mondayOf, addDays, shortDate } from '../util.js';
import { allDays, getReport } from '../store.js';
import { dayMin, isLogged, firstLoggedKey, weekNumber } from '../calc.js';
import { weekEntries, buildReport, reportText, generateReport } from '../report-writer.js';

const days = allDays();
const startKey = firstLoggedKey(days);
const sum = list => list.reduce((a, b) => a + b, 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Mondays of every week that has at least one logged day, newest first
const weeks = [...new Set(Object.keys(days).filter(key => isLogged(days[key])).map(mondayOf))].sort().reverse();

// Everything the row (and the tap) needs to know about one week
function info(weekStart) {
  const entries = weekEntries(weekStart, days), built = buildReport(weekStart, days), saved = getReport(weekStart);
  return {
    weekStart, saved,
    number: weekNumber(weekStart, startKey),
    range: `${shortDate(weekStart)} - ${shortDate(addDays(weekStart, 6))}`,
    minutes: sum(entries.map(e => dayMin(e.day))),
    daysLogged: entries.length,
    photos: sum(entries.map(e => e.day.images.length)),
    missing: built.missing.length,                       // days without Tasks done
    writable: built.paragraphs.length > 0,               // at least one day can be written
    outdated: !!saved && saved.text !== reportText(built.paragraphs), // logs changed after the report was generated
  };
}

const row = w => `
  <button class="card report-item" type="button" data-week="${w.weekStart}">
    <div class="report-item-title">
      <b>Week ${w.number}</b>
      ${w.weekStart === mondayOf(todayKey()) ? '<span class="tag">This week</span>' : ''}
      <span class="report-item-range">${w.range}</span>
    </div>
    <p class="report-item-meta">${plural(w.daysLogged, 'day')} logged \u00b7 ${fmt(w.minutes)} \u00b7 ${plural(w.photos, 'photo')}</p>
    <div class="report-item-flags">
      ${w.saved ? '<span class="tag">Report ready</span>' : '<span class="tag">Not generated</span>'}
      ${w.outdated ? '<span class="tag tag-over">Logs changed since</span>' : ''}
      ${w.missing ? `<span class="tag tag-late">${plural(w.missing, 'day')} without Tasks done</span>` : ''}
    </div>
  </button>`;

$('[data-bind="list"]').innerHTML = weeks.length
  ? weeks.map(weekStart => row(info(weekStart))).join('')
  : '<p class="card card-note">No weeks yet. Log your first day on the Home page and it will appear here.</p>';

$('[data-bind="list"]').addEventListener('click', e => {
  const button = e.target.closest('[data-week]');
  if (!button) return;
  const w = info(button.dataset.week), url = `report.html?week=${w.weekStart}`;
  if (w.saved) { location.href = url; return; }                      // existing report: open it right away
  if (!w.writable) { alert(`Week ${w.number} has no Tasks done yet. Add Tasks done to at least one day first.`); return; }
  if (confirm(`Generate the weekly report for Week ${w.number} (${w.range})?`)) { generateReport(w.weekStart); location.href = url; }
});
