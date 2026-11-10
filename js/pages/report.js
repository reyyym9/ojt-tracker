// WEEKLY REPORT (report.html?week=2026-11-02): the draft or academic narrative, copy / download, and the week's photos.
import { $, setText, esc, todayKey, mondayOf, addDays, shortDate, dayLabel } from '../util.js';
import { allDays, getReport, getSettings } from '../store.js';
import { firstLoggedKey, weekNumber } from '../calc.js';
import { weekEntries, buildReport, generateReport, isOutdated, isBasicReport, buildPrompt, checkAiAnswer, saveAiAnswer } from '../report-writer.js';
import { getImage } from '../images.js';
import '../autosize.js';

// Which week? The ?week=... part of the address (a Monday). Falls back to the current week.
const param = new URLSearchParams(location.search).get('week');
const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(param || '') ? mondayOf(param) : mondayOf(todayKey());
const days = allDays();
const startKey = firstLoggedKey(days);
const number = startKey ? weekNumber(weekStart, startKey) : 0;
const weekRange = `${shortDate(weekStart)} - ${shortDate(addDays(weekStart, 6))}`;
setText('week', `${number >= 1 ? `Week ${number} \u00b7 ` : ''}${weekRange}`);

// ---- the narrative: a draft follows the latest logs; a saved academic version stays until replaced ----
const { paragraphs: fresh, missing } = buildReport(weekStart, days);
const existing = getReport(weekStart);
if (fresh.length && (!existing || (isBasicReport(existing) && isOutdated(existing, weekStart, days)))) generateReport(weekStart);
const saved = getReport(weekStart);
const text = saved ? saved.text : '';
const paragraphs = text ? text.split('\n\n') : [];
const basic = !saved || isBasicReport(saved);
setText('narrativeTitle', basic ? 'Draft narrative' : 'Academic narrative');
$('[data-bind="paragraphs"]').innerHTML = paragraphs.length
  ? paragraphs.map(p => `<p class="report-paragraph">${esc(p)}</p>`).join('')
  : '<p class="card-note">No days with Tasks done this week yet.</p>';
if (saved) {
  const outdated = !basic && isOutdated(saved, weekStart, days); // the logs changed after the answer was saved
  const when = new Date(saved.generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  setText('generated', `${basic ? 'Draft updated' : 'Saved'} ${when}.${outdated ? ' Your logs changed since then. Copy the prompt again and save the new answer.' : ''}`);
  $('[data-bind="generated"]').classList.toggle('note-warn', outdated);
  $('[data-bind="generated"]').hidden = false;
}
if (missing.length) {
  setText('missing', `Left out because Tasks done is empty: ${missing.map(dayLabel).join(', ')}.`);
  $('[data-bind="missing"]').hidden = false;
}

$('#regen-btn').hidden = basic;
$('#regen-btn').addEventListener('click', () => {
  if (confirm('Replace the academic version with the automatic draft? The saved academic text will be removed.')) { generateReport(weekStart); location.reload(); }
});
$('#copy-btn').disabled = $('#download-btn').disabled = $('#docx-btn').disabled = !paragraphs.length;

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); }
  catch (e) { // older browsers: select the text in a hidden box and copy it
    const box = document.createElement('textarea');
    box.value = value; document.body.appendChild(box); box.select(); document.execCommand('copy'); box.remove();
  }
}
function flash(button, message) {
  const label = button.textContent;
  button.textContent = message;
  setTimeout(() => { button.textContent = label; }, 1500);
}
$('#copy-btn').addEventListener('click', async e => { const button = e.currentTarget; await copyText(text); flash(button, 'Copied!'); });

// ---- the academic version: copy the prompt, paste the AI's answer back ----
$('[data-bind="aiCard"]').hidden = !fresh.length;
$('#copy-prompt-btn').addEventListener('click', async e => {
  const button = e.currentTarget;
  await copyText(buildPrompt(weekStart, days));
  flash(button, 'Prompt copied!');
});
$('#save-ai-btn').addEventListener('click', () => {
  const answer = $('#ai-answer').value;
  if (!answer.trim()) { alert('Paste the AI answer in the box first.'); $('#ai-answer').focus(); return; }
  const warnings = checkAiAnswer(answer, weekStart, days);
  if (warnings.length && !confirm(`Please check this answer:\n\n${warnings.join('\n')}\n\nSave it anyway?`)) return;
  saveAiAnswer(answer, weekStart, days);
  location.reload();
});

const toBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const saveAs = async (blob, name) => { // saves `blob` under `name`
  const { Filesystem, Share } = window.Capacitor?.Plugins || {};
  if (Filesystem && Share) { // Android app: save a temporary file, then open the share sheet
    const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: 'CACHE' });
    await Share.share({ title: name, files: [uri] });
    return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
const fileBase = number >= 1 ? `week-${number}` : weekStart;
$('#download-btn').addEventListener('click', () => saveAs(new Blob([text], { type: 'text/plain' }), `weekly-report-${fileBase}.txt`));

// ---- photos of the week ----
const entries = weekEntries(weekStart, days);
const expectedPhotos = entries.reduce((total, { day }) => total + day.images.length, 0);
const photoItems = (async () => {
  const items = [];
  for (const { key, day } of entries) {
    for (const id of day.images) { const record = await getImage(id); if (record) items.push({ key, blob: record.blob, caption: day.captions?.[id] || '' }); }
  }
  return items;
})();

// The picture's width and height, limited so it fits comfortably on a page
const photoSize = blob => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob), image = new Image();
  image.onload = () => {
    const scale = Math.min(1, 480 / image.naturalWidth, 420 / image.naturalHeight);
    URL.revokeObjectURL(url);
    resolve({ width: Math.round(image.naturalWidth * scale), height: Math.round(image.naturalHeight * scale) });
  };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read a photo.')); };
  image.src = url;
});

// Word export: Times New Roman 12, justified, 1.5 line spacing, first-line indent, then the photos
async function buildWordFile() {
  const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = window.docx;
  const font = 'Times New Roman';
  const centered = (content, options = {}, spacing = { after: 120 }) => new Paragraph({
    alignment: AlignmentType.CENTER, spacing,
    children: [new TextRun({ text: content, font, size: 24, ...options })],
  });
  const company = getSettings().company;
  const children = [
    centered('Weekly Narrative Report', { bold: true, size: 28 }),
    centered(`${number >= 1 ? `Week ${number}: ` : ''}${weekRange}`),
    ...(company ? [centered(company)] : []),
    ...paragraphs.map(paragraph => new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 720 },
      spacing: { before: 240, line: 360 },
      children: [new TextRun({ text: paragraph, font, size: 24 })],
    })),
  ];

  const items = await photoItems;
  if (items.length) {
    children.push(new Paragraph({
      pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: 'Photo Documentation', font, size: 28, bold: true })],
    }));
    for (const item of items) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 240, after: 80 },
        children: [new ImageRun({
          type: item.blob.type === 'image/png' ? 'png' : 'jpg',
          data: new Uint8Array(await item.blob.arrayBuffer()),
          transformation: await photoSize(item.blob),
        })],
      }));
      children.push(centered(`${dayLabel(item.key)}${item.caption ? `: ${item.caption}` : ''}`, { size: 22, italics: true }));
    }
  }

  const document = new Document({ sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }] });
  await saveAs(await Packer.toBlob(document), `weekly-report-${fileBase}.docx`);
  if (items.length < expectedPhotos) alert(`${expectedPhotos - items.length} photo(s) were not available on this device and were left out. Connect Google Drive and try again.`);
}

$('#docx-btn').addEventListener('click', async e => {
  const button = e.currentTarget, label = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing...';
  try { await buildWordFile(); }
  catch (error) { alert(`Could not create the Word file. ${error.message}`); }
  button.disabled = false;
  button.textContent = label;
});

// ---- on-screen photos, each with its own Save button ----
(async () => {
  const items = await photoItems;
  if (!items.length) return;
  const urls = items.map(item => URL.createObjectURL(item.blob));
  $('[data-bind="photos"]').innerHTML = items.map((item, i) => `
    <figure class="report-photo">
      <img src="${urls[i]}" alt="${esc(item.caption) || `Photo from ${dayLabel(item.key)}`}">
      <figcaption>${dayLabel(item.key)}${item.caption ? `<span class="report-photo-note">${esc(item.caption)}</span>` : ''}</figcaption>
      <button class="btn btn-small" type="button" data-save="${i}">Save</button>
    </figure>`).join('');
  $('[data-bind="photoCard"]').hidden = false;
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-save]');
    if (button) { const item = items[button.dataset.save]; saveAs(item.blob, `${fileBase}-${item.key}-${Number(button.dataset.save) + 1}.jpg`); }
  });
})();