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

// Returns an error message, or '' when the day is fine to save
export function validate(day) {
  const slots = day.mode === 'whole' ? [['Whole day', day.am]] : [['Morning', day.am], ['Afternoon', day.pm]];
  let hasTimes = false;
  for (const [name, slot] of slots) {
    if (!slot.in && !slot.out) continue;
    hasTimes = true;
    if (!slot.in || !slot.out) return `${name}: fill in both time in and time out.`;
    if (toMin(slot.out) <= toMin(slot.in)) return `${name}: time out must be after time in.`;
  }
  return hasTimes || day.log.trim() ? '' : 'Enter at least one time in and time out.';
}
