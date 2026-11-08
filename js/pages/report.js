// WEEKLY REPORT (report.html?week=2026-11-02): the generated paragraphs, copy / download, and the week's photos.
import { $, setText, esc, todayKey, mondayOf, addDays, shortDate, dayLabel } from '../util.js';
import { allDays, getReport } from '../store.js';
import { firstLoggedKey, weekNumber } from '../calc.js';
import { weekEntries, buildReport, reportText, generateReport } from '../report-writer.js';
import { getImage } from '../images.js';

// Which week? The ?week=... part of the address (a Monday). Falls back to the current week.
const param = new URLSearchParams(location.search).get('week');
const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(param || '') ? mondayOf(param) : mondayOf(todayKey());
const days = allDays();
const startKey = firstLoggedKey(days);
const number = startKey ? weekNumber(weekStart, startKey) : 0;
setText('week', `${number >= 1 ? `Week ${number} \u00b7 ` : ''}${shortDate(weekStart)} - ${shortDate(addDays(weekStart, 6))}`);

// ---- the narrative: the saved report ("Regenerate" rebuilds it from the current logs) ----
const { paragraphs: fresh, missing } = buildReport(weekStart, days);
if (!getReport(weekStart) && fresh.length) generateReport(weekStart); // opened without generating first: create it now
const saved = getReport(weekStart);
const text = saved ? saved.text : '';
const paragraphs = text ? text.split('\n\n') : [];
$('[data-bind="paragraphs"]').innerHTML = paragraphs.length
  ? paragraphs.map(p => `<p class="report-paragraph">${esc(p)}</p>`).join('')
  : '<p class="card-note">No days with Tasks done this week yet.</p>';
if (saved) {
  const outdated = saved.text !== reportText(fresh); // the logs changed after the report was generated
  const when = new Date(saved.generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  setText('generated', `Generated ${when}.${outdated ? ' Your logs changed since then. Tap Regenerate to update it.' : ''}`);
  $('[data-bind="generated"]').classList.toggle('note-warn', outdated);
  $('[data-bind="generated"]').hidden = false;
}
if (missing.length) {
  setText('missing', `Left out because Tasks done is empty: ${missing.map(dayLabel).join(', ')}.`);
  $('[data-bind="missing"]').hidden = false;
}
$('#regen-btn').disabled = !fresh.length;
$('#regen-btn').addEventListener('click', () => {
  if (confirm('Regenerate this report from your current logs? The saved version will be replaced.')) { generateReport(weekStart); location.reload(); }
});
$('#copy-btn').disabled = $('#download-btn').disabled = !paragraphs.length;

$('#copy-btn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { // older browsers: select the text in a hidden box and copy it
    const box = document.createElement('textarea');
    box.value = text; document.body.appendChild(box); box.select(); document.execCommand('copy'); box.remove();
  }
  $('#copy-btn').textContent = 'Copied!';
  setTimeout(() => { $('#copy-btn').textContent = 'Copy report'; }, 1500);
});

const saveAs = (blob, name) => { // starts a download of `blob` under `name`
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
const fileBase = number >= 1 ? `week-${number}` : weekStart;
$('#download-btn').addEventListener('click', () => saveAs(new Blob([text], { type: 'text/plain' }), `weekly-report-${fileBase}.txt`));

// ---- photos of the week, each with its own Save button ----
(async () => {
  const items = [];
  for (const { key, day } of weekEntries(weekStart, days)) {
    for (const id of day.images) { const record = await getImage(id); if (record) items.push({ key, blob: record.blob }); }
  }
  if (!items.length) return;
  const urls = items.map(item => URL.createObjectURL(item.blob));
  $('[data-bind="photos"]').innerHTML = items.map((item, i) => `
    <figure class="report-photo">
      <img src="${urls[i]}" alt="Photo from ${dayLabel(item.key)}">
      <figcaption>${dayLabel(item.key)}</figcaption>
      <button class="btn btn-small" type="button" data-save="${i}">Save</button>
    </figure>`).join('');
  $('[data-bind="photoCard"]').hidden = false;
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-save]');
    if (button) { const item = items[button.dataset.save]; saveAs(item.blob, `${fileBase}-${item.key}-${Number(button.dataset.save) + 1}.jpg`); }
  });
})();
