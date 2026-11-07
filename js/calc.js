// CALC: all the math (hours, late, overtime, progress). No page code in here.
import { toMin, keyOf } from './util.js';

export const GRACE_MINUTES = 0; // minutes after the official time in that still count as on time
const sum = list => list.reduce((a, b) => a + b, 0);
const slotMin = slot => (slot && slot.in && slot.out && toMin(slot.out) > toMin(slot.in)) ? toMin(slot.out) - toMin(slot.in) : 0;

// Minutes worked in a day
export const dayMin = day => slotMin(day.am) + (day.mode === 'whole' ? 0 : slotMin(day.pm));

// Minutes late: first time in compared with the official time in
export function lateMin(day, settings) {
  if (!day.am.in) return 0;
  const diff = toMin(day.am.in) - toMin(settings.officialIn);
  return diff > GRACE_MINUTES ? diff : 0;
}
// Minutes worked beyond the hours-per-day target
export const overtimeMin = (day, settings) => Math.max(0, dayMin(day) - settings.hoursPerDay * 60);

// Progress toward the required OJT hours
export function overall(days, settings) {
  const worked = Object.values(days).map(dayMin).filter(m => m > 0);
  const done = sum(worked), required = settings.required * 60, left = Math.max(0, required - done);
  return {
    done, left,
    pct: required ? Math.min(100, done / required * 100) : 0,
    daysLogged: worked.length,
    daysLeft: Math.ceil(left / (settings.hoursPerDay * 60)),
  };
}

// Estimated last day: count working days forward from tomorrow.
// Work days are the first `daysPerWeek` days of the week, starting Monday.
export function finishDate(leftMin, settings) {
  if (leftMin <= 0) return null;
  let daysToGo = Math.ceil(leftMin / (settings.hoursPerDay * 60));
  const d = new Date();
  while (daysToGo > 0) {
    d.setDate(d.getDate() + 1);
    if ((d.getDay() + 6) % 7 < settings.daysPerWeek) daysToGo--;
  }
  return keyOf(d);
}

// The daily notes used for the weekly narrative report: [field name, label]
export const NOTES = [
  ['tasks', 'Tasks done'],
  ['challenges', 'Challenges encountered'],
  ['solutions', 'How I overcame these challenges'],
];
export const REQUIRE_PHOTO = false; // set to true to also ask for at least one photo before a day counts as finished

// Returns an error message, or '' when the times can be saved.
// A day may be saved with only a time in; the notes are checked separately by dayStatus().
export function validate(day) {
  const slots = day.mode === 'whole' ? [['Whole day', day.am]] : [['Morning', day.am], ['Afternoon', day.pm]];
  let hasTimeIn = false;
  for (const [name, slot] of slots) {
    if (!slot.in && !slot.out) continue;
    if (!slot.in) return `${name}: add a time in.`;
    hasTimeIn = true;
    if (slot.out && toMin(slot.out) <= toMin(slot.in)) return `${name}: time out must be after time in.`;
  }
  return hasTimeIn ? '' : 'Enter a time in to save.';
}

// Where is this day in its life?
//   "empty"       no time in yet
//   "open"        timed in, but no time out yet (still working)
//   "needs-notes" has a time out, but "Tasks done" is empty
//   "needs-photo" only when REQUIRE_PHOTO is on and there are no photos
//   "complete"    has a time out and Tasks done: the total hours can be shown
export function dayStatus(day) {
  const slots = day.mode === 'whole' ? [day.am] : [day.am, day.pm];
  if (!slots.some(slot => slot.in)) return 'empty';
  if (!slots.some(slot => slot.in && slot.out)) return 'open';
  if (!String(day.tasks || '').trim()) return 'needs-notes';   // spaces only does not count
  if (REQUIRE_PHOTO && !(day.images || []).length) return 'needs-photo';
  return 'complete';
}

// The reminder shown after saving, or '' when nothing is missing
export const statusMessage = status => ({
  'needs-notes': "You've timed out. Add what you did today under Tasks done to finish this entry.",
  'needs-photo': 'Add at least one photo to finish this entry.',
}[status] || '');
