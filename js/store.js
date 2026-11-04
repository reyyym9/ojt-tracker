// STORE: the app's "backend". Saves everything in the browser/phone with localStorage (works offline).
//   settings : { required, company, officialIn, hoursPerDay, daysPerWeek, remind:{in:{on,time}, out:{on,time}} }
//   days     : { "2026-11-03": { mode: "split" | "whole", am:{in,out}, pm:{in,out}, tasks, challenges, solutions } }
//              (in "whole" mode the whole-day times are kept in `am`)
const KEY = 'ojt-diy-v1';

const defaults = () => ({
  settings: {
    required: 240, company: '', officialIn: '08:00', hoursPerDay: 8, daysPerWeek: 5,
    remind: { in: { on: false, time: '07:45' }, out: { on: false, time: '17:00' } },
  },
  days: {},
});

// Turns saved or imported data into a complete, safe object (fills in anything missing)
function normalize(saved) {
  const base = defaults().settings, s = (saved && saved.settings) || {};
  const days = {};
  for (const [key, d] of Object.entries((saved && saved.days) || {})) {
    // Old entries had one note called `log`; it becomes the "tasks" note
    days[key] = {
      mode: d.mode === 'whole' ? 'whole' : 'split', am: { ...d.am }, pm: { ...d.pm },
      tasks: String(d.tasks ?? d.log ?? ''), challenges: String(d.challenges || ''), solutions: String(d.solutions || ''),
    };
  }
  return { settings: { ...base, ...s, remind: { ...base.remind, ...s.remind } }, days };
}

let db = defaults();
try { db = normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { /* first run or unreadable data */ }

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Could not save your data.'); } };

export const getSettings = () => db.settings;
export const saveSettings = settings => { db.settings = settings; persist(); };
export const allDays = () => db.days;
export const getDay = key => db.days[key] || { mode: 'split', am: {}, pm: {}, tasks: '', challenges: '', solutions: '' }; // blank day if none saved
export const saveDay = (key, day) => { db.days[key] = day; persist(); };
export const hasDay = key => key in db.days;
export const deleteDay = key => { delete db.days[key]; persist(); };

// Backup: everything as one JSON text, and the way back
export const exportJSON = () => JSON.stringify(db, null, 1);
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.days !== 'object') throw new Error('Not an OJT backup');
  db = normalize(data);
  persist();
}
