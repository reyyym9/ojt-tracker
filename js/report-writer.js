// REPORT WRITER: turns one week of saved days into the weekly narrative report (one paragraph per day).
// The app writes a basic draft by itself. For the academic version, it builds a prompt that the user
// pastes into a free AI chat, then the user pastes the answer back into the app.
import { addDays, parseKey } from './util.js';
import { isLogged } from './calc.js';
import { saveReport, allDays } from './store.js';

// The logged days of a week (weekStart = its Monday), in date order: [{ key, day }]
export const weekEntries = (weekStart, days) =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter(key => days[key] && isLogged(days[key]))
    .map(key => ({ key, day: days[key] }));

// ---- small text helpers ----
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// One note -> one clean phrase: bullets removed, lines joined with "; ", no trailing punctuation
const clean = text => String(text || '').split(/\r?\n/)
  .map(line => line.trim().replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '')).filter(Boolean).join('; ').replace(/[\s.;,]+$/, '');

// Different openers per day so the paragraphs do not all read the same
const OPENERS = {
  tasks: ['My tasks for the day were: ', 'The work I completed included: ', 'Throughout the day, I handled the following: '],
  challenge: ['A challenge I encountered was: ', 'I ran into the following difficulty: ', 'One difficulty I faced was: '],
  solution: ['I overcame this by: ', 'I resolved it by: ', 'I dealt with it by: '],
};

// The basic paragraph of one day. `i` is the day's position in the report (used to vary the wording).
export function writeParagraph(key, day, i = 0) {
  const pick = list => list[i % list.length];
  const when = parseKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); // "Monday, November 2"
  const parts = [`On ${when}, I carried out my assigned training activities.`];

  if (clean(day.tasks)) parts.push(`${pick(OPENERS.tasks)}${clean(day.tasks)}.`);
  if (clean(day.challenges)) parts.push(`${pick(OPENERS.challenge)}${clean(day.challenges)}.`);
  if (clean(day.solutions)) parts.push(`${clean(day.challenges) ? pick(OPENERS.solution) : 'What helped me move forward was: '}${clean(day.solutions)}.`);
  if (day.images.length) parts.push(`I attached ${plural(day.images.length, 'photo')} to document this work.`);
  return parts.join(' ');
}

// The basic report. Days without "Tasks done" cannot be written, so they are listed in `missing`.
export function buildReport(weekStart, days) {
  const entries = weekEntries(weekStart, days);
  const ready = entries.filter(e => e.day.tasks.trim());
  return {
    paragraphs: ready.map((e, i) => ({ key: e.key, text: writeParagraph(e.key, e.day, i) })),
    missing: entries.filter(e => !e.day.tasks.trim()).map(e => e.key),
  };
}
export const reportText = paragraphs => paragraphs.map(p => p.text).join('\n\n'); // plain text, one blank line between days

// ---- the notes behind a report ----
const notesOf = (weekStart, days) => weekEntries(weekStart, days).filter(e => e.day.tasks.trim()).map(({ key, day }) => ({
  key, tasks: day.tasks, challenges: day.challenges, solutions: day.solutions,
  captions: day.images.map(id => day.captions?.[id]).filter(Boolean),
}));

// A short code that changes whenever the notes change, used for "Your logs changed"
function fingerprint(weekStart, days) {
  let hash = 5381;
  for (const char of JSON.stringify(notesOf(weekStart, days))) hash = (hash * 33 + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

export const isBasicReport = saved => !saved.fingerprint?.startsWith('ai:');
export const isOutdated = (saved, weekStart, days) => saved.fingerprint?.split(':')[1] !== fingerprint(weekStart, days);

// Writes the basic draft of a week from the current logs and saves it. Returns how many paragraphs it has.
export function generateReport(weekStart) {
  const days = allDays();
  const { paragraphs } = buildReport(weekStart, days);
  if (paragraphs.length) saveReport(weekStart, reportText(paragraphs), `basic:${fingerprint(weekStart, days)}`);
  return paragraphs.length;
}

// ---- the academic version: a prompt for a free AI chat, and saving its answer ----
const WRITING_GUIDE = `You are helping me write the weekly narrative report for my on-the-job training (OJT) journal.

Write exactly one paragraph for each day below, using only that day's notes.

Style:
- Use formal, academic English in the first person ("I") and past tense.
- Write 3 to 5 complete sentences per paragraph, with smooth transitions and no contractions.
- Begin each paragraph with its date, written as shown, for example "On Monday, November 2, 2026, ...".
- Do not copy my notes word for word.

Content:
- Focus on what I did, the purpose of that work, any challenge and how I resolved it, and what I learned when the notes support it.
- Never mention clock times, hours or minutes worked, time in or time out, overtime, or lateness, even if they appear in the notes.
- Never invent tools, people, results, or other specifics that are not in the notes. If a note is brief, explain the general purpose or significance of the stated work instead of adding new events.
- Photo descriptions are extra context about the work. Do not mention the photos themselves.

Return only the paragraphs in date order, separated by one blank line. Do not add a title, bullets, markdown, or comments.`;

const fullDate = key => parseKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function buildPrompt(weekStart, days) {
  const notes = notesOf(weekStart, days).map(day => [
    `Date: ${fullDate(day.key)}`,
    `Tasks done: ${day.tasks}`,
    day.challenges && `Challenges: ${day.challenges}`,
    day.solutions && `How I handled them: ${day.solutions}`,
    day.captions.length && `Photo descriptions: ${day.captions.join('; ')}`,
  ].filter(Boolean).join('\n'));
  return `${WRITING_GUIDE}\n\nMy notes:\n\n${notes.join('\n\n')}`;
}

// Tidies what the user pasted: one paragraph per block, no markdown symbols or bullets
const pastedParagraphs = text => String(text || '').replace(/\r/g, '').split(/\n+/)
  .map(line => line.replace(/\*\*|__/g, '').replace(/^\s*(?:#+|[-*\u2022])\s+/, '').trim()).filter(Boolean);

// Problems worth asking the user about before saving
export function checkAiAnswer(text, weekStart, days) {
  const paragraphs = pastedParagraphs(text), expected = notesOf(weekStart, days).length, warnings = [];
  if (paragraphs.length !== expected) warnings.push(`It has ${plural(paragraphs.length, 'paragraph')}, but this week has ${plural(expected, 'logged day')}.`);
  if (paragraphs.some(p => /\b\d{1,2}(:\d{2})\b|\b\d{1,2}\s?(?:a\.?m\.?|p\.?m\.?)(?![a-z])|\b\d+\s*(?:hours?|hrs?|minutes?|mins?)\b/i.test(p))) warnings.push('It seems to mention a time or number of hours.');
  return warnings;
}

export function saveAiAnswer(text, weekStart, days) {
  saveReport(weekStart, pastedParagraphs(text).join('\n\n'), `ai:${fingerprint(weekStart, days)}`);
}