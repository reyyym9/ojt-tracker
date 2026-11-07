// DASHBOARD (index.html): progress numbers + weekly chart.
import { $, setText, todayKey, mondayOf, addDays, shortDate, longDate, fmt } from '../util.js';
import { getSettings, allDays, getDay } from '../store.js';
import { overall, dayMin, finishDate, firstLoggedKey, weekNumber } from '../calc.js';

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
}

// Previous / next week buttons carry data-week="-1" or "1"
document.addEventListener('click', e => {
  const button = e.target.closest('[data-week]');
  if (!button) return;
  weekStart = addDays(weekStart, 7 * Number(button.dataset.week));
  renderChart();
});

renderOverview();
renderChart();
