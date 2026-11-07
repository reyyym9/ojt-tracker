// DASHBOARD (index.html): progress numbers + weekly chart.
import { $, setText, todayKey, mondayOf, addDays, shortDate, longDate, fmt, esc, dayLabel } from '../util.js';
import { getSettings, allDays, getDay } from '../store.js';
import { overall, dayMin, finishDate, firstLoggedKey, weekNumber } from '../calc.js';
import { weekEntries } from '../report.js';
import { getImage } from '../images.js';

const settings = getSettings();
let weekStart = mondayOf(todayKey()); // Monday of the week shown in the chart
const startKey = firstLoggedKey(allDays()); // first logged day = start of Week 1

function renderOverview() {
  const o = overall(allDays(), settings);
  setText('company', settings.company || 'Set your company in Settings');
  setText('percent', o.pct.toFixed(1) + '%');
  setText('detail', `${fmt(o.done)} of ${settings.required}h done`);
  $('[data-bind="bar"]').style.width = o.pct + '%';
  $('.progress').setAttribute('aria-valuenow', o.pct.toFixed(1));
  setText('left', fmt(o.left));
  setText('daysLeft', o.daysLeft);
  setText('daysLogged', o.daysLogged);
  const thisWeek = startKey ? weekNumber(todayKey(), startKey) : 0;
  setText('weekBadge', thisWeek >= 1 ? 'Week ' + thisWeek : 'Not started yet');
  const end = finishDate(o.left, settings);
  setText('finish', end ? 'Estimated finish: ' + longDate(end) : 'OJT hours completed!');
}

function renderChart() {
  const mins = Array.from({ length: 7 }, (_, i) => dayMin(getDay(addDays(weekStart, i))));
  const target = settings.hoursPerDay * 60;
  const max = Math.max(600, target * 1.25, ...mins); // chart height = at least 10 hours
  const columns = mins.map(m => `
    <div class="chart-col" style="--h: ${(m / max * 100).toFixed(1)}%">
      ${m ? `<span class="chart-value">${(m / 60).toFixed(1)}</span>` : ''}
      <div class="chart-bar${m > target ? ' chart-bar-over' : ''}"></div>
    </div>`).join('');

  const plot = $('.chart-plot');
  plot.querySelectorAll('.chart-col').forEach(col => col.remove()); // remove old bars
  plot.insertAdjacentHTML('beforeend', columns);
  $('.chart-target').style.setProperty('--target', (target / max * 100) + '%');
  const n = startKey ? weekNumber(weekStart, startKey) : 0;
  setText('weekTitle', n >= 1 ? 'Week ' + n : weekStart === mondayOf(todayKey()) ? 'This week' : 'Before Week 1');
  setText('weekLabel', `${shortDate(weekStart)} - ${shortDate(addDays(weekStart, 6))}`);
  renderWeekWork();
}

// ---- tasks, photos and the report button for the week shown in the chart ----
let workRun = 0, workUrls = []; // workRun lets us ignore a slow photo load if the user already changed week
const weekText = () => {
  const n = startKey ? weekNumber(weekStart, startKey) : 0;
  return `${n >= 1 ? `Week ${n} ` : ''}(${shortDate(weekStart)} - ${shortDate(addDays(weekStart, 6))})`;
};

async function renderWeekWork() {
  const run = ++workRun;
  const entries = weekEntries(weekStart, allDays());
  const withTasks = entries.filter(e => e.day.tasks.trim()), missing = entries.filter(e => !e.day.tasks.trim());
  const n = startKey ? weekNumber(weekStart, startKey) : 0;

  setText('workTitle', n >= 1 ? `Week ${n}: tasks and photos` : 'Tasks and photos');
  $('[data-bind="tasks"]').innerHTML = withTasks.length
    ? `<ul class="week-tasks">${withTasks.map(e => `<li><span class="week-tasks-day">${dayLabel(e.key)}</span><span class="week-tasks-text">${esc(e.day.tasks)}</span></li>`).join('')}</ul>`
    : '<p class="card-note">No tasks logged this week yet.</p>';
  $('#report-btn').disabled = !withTasks.length;
  setText('reportNote', !withTasks.length ? 'Add Tasks done to at least one day to generate a report.'
    : missing.length ? `Left out of the report because Tasks done is empty: ${missing.map(e => dayLabel(e.key)).join(', ')}.` : '');

  const records = await Promise.all(entries.flatMap(e => e.day.images).map(id => getImage(id)));
  if (run !== workRun) return;                      // the user changed week while photos were loading
  workUrls.forEach(url => URL.revokeObjectURL(url)); // free the old thumbnails
  workUrls = records.filter(Boolean).map(record => URL.createObjectURL(record.blob));
  $('[data-bind="weekPhotos"]').innerHTML = workUrls.map(url => `<figure class="photo"><img src="${url}" alt="Photo from this week"></figure>`).join('');
}

// Generate button: ask first, then open the report page for this week
$('#report-btn').addEventListener('click', () => {
  if (confirm(`Generate the weekly report for ${weekText()}?`)) location.href = `report.html?week=${weekStart}`;
});

// Previous / next week buttons carry data-week="-1" or "1"
document.addEventListener('click', e => {
  const button = e.target.closest('[data-week]');
  if (!button) return;
  weekStart = addDays(weekStart, 7 * Number(button.dataset.week));
  renderChart();
});

renderOverview();
renderChart();
