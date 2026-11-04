// STORE: the app's "backend". Saves everything in the browser/phone with localStorage (works offline).
//   settings : { required, company, officialIn, hoursPerDay, daysPerWeek, remind:{in:{on,time}, out:{on,time}} }
//   days     : { "2026-11-03": { mode: "split" | "whole", am:{in,out}, pm:{in,out}, log: "notes" } }
//              (in "whole" mode the whole-day times are kept in `am`)
const KEY = 'ojt-diy-v1';

const defaults = () => ({
  settings: {
    required: 240, company: '', officialIn: '08:00', hoursPerDay: 8, daysPerWeek: 5,
    remind: { in: { on: false, time: '07:45' }, out: { on: false, time: '17:00' } },
  },
  days: {},
});

let db = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) {
    const base = defaults().settings;
    db = { settings: { ...base, ...saved.settings, remind: { ...base.remind, ...(saved.settings || {}).remind } }, days: saved.days || {} };
  }
} catch (e) { /* first run or unreadable data: keep the defaults */ }

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Could not save your data.'); } };

export const getSettings = () => db.settings;
export const saveSettings = settings => { db.settings = settings; persist(); };
export const allDays = () => db.days;
export const getDay = key => db.days[key] || { mode: 'split', am: {}, pm: {}, log: '' }; // blank day if none saved
export const saveDay = (key, day) => { db.days[key] = day; persist(); };
