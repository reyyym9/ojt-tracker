// LOG TODAY (log.html): fill in today's times and notes, save, show the total.
import { $, setText, todayKey, nowHM, longDate, fmt } from '../util.js';
import { getDay, saveDay } from '../store.js';
import { dayMin, validate, NOTES } from '../calc.js';
import { autosizeAll } from '../autosize.js';

const key = todayKey();
const value = id => $('#' + id).value;
setText('today', longDate(key));

// Fill the form with today's saved entry (if there is one)
const saved = getDay(key);
const wholeDay = saved.mode === 'whole';
$('#mode-whole').checked = wholeDay;
$('#mode-split').checked = !wholeDay;
if (wholeDay) { $('#day-in').value = saved.am.in || ''; $('#day-out').value = saved.am.out || ''; }
else {
  $('#am-in').value = saved.am.in || ''; $('#am-out').value = saved.am.out || '';
  $('#pm-in').value = saved.pm.in || ''; $('#pm-out').value = saved.pm.out || '';
}
NOTES.forEach(([field]) => { $('#' + field).value = saved[field] || ''; });
autosizeAll(); // fit the boxes to any saved text
if (dayMin(saved) > 0) showTotal(saved);

function showTotal(day) {
  setText('total', fmt(dayMin(day)));
  $('.result').hidden = false;
}

// "Use current time" buttons carry data-now="am-in" (the id of the input to fill)
document.addEventListener('click', e => {
  const button = e.target.closest('[data-now]');
  if (button) $('#' + button.dataset.now).value = nowHM();
});

$('.log-form').addEventListener('submit', e => {
  e.preventDefault();
  const whole = $('#mode-whole').checked;
  const notes = Object.fromEntries(NOTES.map(([field]) => [field, value(field).trim()]));
  const day = whole
    ? { mode: 'whole', am: { in: value('day-in'), out: value('day-out') }, pm: {}, ...notes }
    : { mode: 'split', am: { in: value('am-in'), out: value('am-out') }, pm: { in: value('pm-in'), out: value('pm-out') }, ...notes };

  const error = validate(day);
  if (error) { alert(error); return; }
  saveDay(key, day);
  showTotal(day);
  $('.result').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
