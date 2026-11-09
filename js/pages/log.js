// LOG TODAY (log.html): save today's times (even just a time in), then add notes to finish the day.
import { $, setText, todayKey, nowHM, longDate, fmt } from '../util.js';
import { getDay, saveDay, usedImageIds } from '../store.js';
import { dayMin, validate, NOTES, dayStatus, statusMessage } from '../calc.js';
import { autosizeAll } from '../autosize.js';
import { setupPhotos } from '../photos.js';
import { pruneImages } from '../images.js';

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
pruneImages(usedImageIds()).catch(() => {}); // clean up photos that were never submitted
const photos = setupPhotos(saved.images || [], saved.captions || {});
showResult(saved);

// The card under the Save button depends on how far along the day is
function showResult(day) {
  const status = dayStatus(day);
  $('.result').hidden = !(status === 'complete' || status === 'open'); // no total until Tasks done is filled in
  if (status === 'complete') { setText('resultLabel', 'Total hours today'); setText('total', fmt(dayMin(day))); }
  if (status === 'open') { setText('resultLabel', "Saved. You're timed in."); setText('total', 'In progress'); }
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
  const photoData = { images: photos.getIds(), captions: photos.getCaptions() };
  const day = whole
    ? { mode: 'whole', am: { in: value('day-in'), out: value('day-out') }, pm: {}, ...notes, ...photoData }
    : { mode: 'split', am: { in: value('am-in'), out: value('am-out') }, pm: { in: value('pm-in'), out: value('pm-out') }, ...notes, ...photoData };

  const error = validate(day);
  if (error) { alert(error); return; }
  saveDay(key, day);                       // times are always saved, even without notes
  showResult(day);
  const status = dayStatus(day), message = statusMessage(status);
  if (message) {                           // timed out but something is missing: remind the user
    alert(message);
    if (status === 'needs-notes') $('#tasks').focus();
  } else if (!$('.result').hidden) {
    $('.result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
