// STORE: the app's "backend". Saves everything in the browser/phone with localStorage (works offline).
//   settings : { required, company, officialIn, hoursPerDay, daysPerWeek, remind:{in:{on,time}, out:{on,time}} }
//   reports  : { "2026-11-02": { text, generatedAt } }  (key = Monday of the week; the saved weekly report)
//   days     : { "2026-11-03": { mode: "split" | "whole", am:{in,out}, pm:{in,out}, tasks, challenges, solutions, images:[photoIds] } }
//              (in "whole" mode the whole-day times are kept in `am`)
const KEY = 'ojt-diy-v1';

const defaults = () => ({
  settings: {
    required: 240, company: '', officialIn: '08:00', hoursPerDay: 8, daysPerWeek: 5,
    remind: { in: { on: false, time: '07:45' }, out: { on: false, time: '17:00' } },
  },
  days: {}, reports: {},
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
      images: Array.isArray(d.images) ? d.images.map(String) : [], // ids of photos kept in IndexedDB (see images.js)
    };
  }
  const reports = {};
  for (const [week, r] of Object.entries((saved && saved.reports) || {})) {
    if (r && typeof r.text === 'string') reports[week] = { text: r.text, generatedAt: Number(r.generatedAt) || 0 };
  }
  return { settings: { ...base, ...s, remind: { ...base.remind, ...s.remind } }, days, reports };
}

let db = defaults();
try { db = normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { /* first run or unreadable data */ }

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Could not save your data.'); } };

// Tells sync.js when something changed on this device
let notifySync = () => {};
export const setSyncListener = listener => { notifySync = listener; };

export const getSettings = () => db.settings;
export const saveSettings = settings => { db.settings = settings; persist(); notifySync('settings', 'me'); };
export const allDays = () => db.days;
export const getDay = key => db.days[key] || { mode: 'split', am: {}, pm: {}, tasks: '', challenges: '', solutions: '', images: [] }; // blank day if none saved
export const saveDay = (key, day) => { db.days[key] = day; persist(); notifySync('days', key); };
export const usedImageIds = () => Object.values(db.days).flatMap(day => day.images); // photos that days still use
export const getReport = week => db.reports[week] || null;          // the saved report of a week (or null)
export const saveReport = (week, text) => { db.reports[week] = { text, generatedAt: Date.now() }; persist(); notifySync('reports', week); };
export const hasDay = key => key in db.days;
export const deleteDay = key => { delete db.days[key]; persist(); notifySync('days', key); };

// Backup: everything as one JSON text, and the way back
export const exportJSON = () => JSON.stringify(db, null, 1);
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.days !== 'object') throw new Error('Not an OJT backup');
  db = normalize(data);
  persist();
  notifySync('all');
}

// ---- used by sync.js ----
export const syncKeys = () => ({ settings: ['me'], days: Object.keys(db.days), reports: Object.keys(db.reports) });
export function syncValue(table, key) {
  if (table === 'settings') return db.settings;
  return (table === 'days' ? db.days[key] : db.reports[key]) || null;
}
export function applyRemote(table, key, value) {
  if (table === 'settings') db.settings = normalize({ settings: value }).settings;
  else if (table === 'days') {
    if (value) db.days[key] = normalize({ days: { [key]: value } }).days[key];
    else delete db.days[key];
  } else db.reports[key] = value;
  persist();
}
export function resetLocal() { db = defaults(); persist(); }

import('./sync.js').then(sync => sync.startSync()).catch(() => {});

if ('serviceWorker' in navigator && !window.Capacitor && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});