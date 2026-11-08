// REPORT WRITER: turns one week of saved days into the weekly narrative report (one paragraph per day).
// The paragraphs are written by simple rules for now (works offline). To use a real AI writer
// later, only writeParagraph() has to change: it gets one day and returns that day's paragraph.
import { addDays, parseKey } from './util.js';
import { dayMin, isLogged } from './calc.js';
import { allDays, saveReport } from './store.js';

// The logged days of a week (weekStart = its Monday), in date order: [{ key, day }]
export const weekEntries = (weekStart, days) =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter(key => days[key] && isLogged(days[key]))
    .map(key => ({ key, day: days[key] }));

// ---- small text helpers ----
const time12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const hoursText = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return [h && plural(h, 'hour'), m && plural(m, 'minute')].filter(Boolean).join(' and '); };
// One note -> one clean phrase: bullets removed, lines joined with "; ", no trailing punctuation
const clean = text => String(text || '').split(/\r?\n/)
  .map(line => line.trim().replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '')).filter(Boolean).join('; ').replace(/[\s.;,]+$/, '');

// Different openers per day so the paragraphs do not all read the same
const OPENERS = {
  tasks: ['My tasks for the day were: ', 'The work I completed included: ', 'Throughout the day, I handled the following: '],
  challenge: ['A challenge I encountered was: ', 'I ran into the following difficulty: ', 'One difficulty I faced was: '],
  solution: ['I overcame this by: ', 'I resolved it by: ', 'I dealt with it by: '],
};

// Writes the paragraph of one day. `i` is the day's position in the report (used to vary the wording).
export function writeParagraph(key, day, i = 0) {
  const pick = list => list[i % list.length];
  const when = parseKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); // "Monday, November 2"
  const minutes = dayMin(day);
  const slots = (day.mode === 'whole' ? [day.am] : [day.am, day.pm]).filter(s => s.in && s.out);
  const parts = [minutes > 0
    ? `On ${when}, I worked for ${hoursText(minutes)} (${slots.map(s => `${time12(s.in)} to ${time12(s.out)}`).join(' and ')}).`
    : `On ${when}, I logged my work for the day.`];

  if (clean(day.tasks)) parts.push(`${pick(OPENERS.tasks)}${clean(day.tasks)}.`);
  if (clean(day.challenges)) parts.push(`${pick(OPENERS.challenge)}${clean(day.challenges)}.`);
  if (clean(day.solutions)) parts.push(`${clean(day.challenges) ? pick(OPENERS.solution) : 'What helped me move forward was: '}${clean(day.solutions)}.`);
  if (day.images.length) parts.push(`I attached ${plural(day.images.length, 'photo')} to document this work.`);
  return parts.join(' ');
}

// The whole report. Days without "Tasks done" cannot be written, so they are listed in `missing`.
export function buildReport(weekStart, days) {
  const entries = weekEntries(weekStart, days);
  const ready = entries.filter(e => e.day.tasks.trim());
  return {
    paragraphs: ready.map((e, i) => ({ key: e.key, text: writeParagraph(e.key, e.day, i) })),
    missing: entries.filter(e => !e.day.tasks.trim()).map(e => e.key),
  };
}
export const reportText = paragraphs => paragraphs.map(p => p.text).join('\n\n'); // plain text, one blank line between days

// Builds the report of a week from the current logs and saves it. Returns how many paragraphs it has.
export function generateReport(weekStart) {
  const { paragraphs } = buildReport(weekStart, allDays());
  saveReport(weekStart, reportText(paragraphs));
  return paragraphs.length;
}
