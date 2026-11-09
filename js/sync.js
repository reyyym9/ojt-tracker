// SYNC: copies days, reports and settings to Supabase, and photos to Google Drive.
// The app keeps working from the device copy. This file only moves changes in the background.
import { sb, getUser, ensureDriveToken } from './auth.js';
import * as store from './store.js';
import { getLocalImage, uploadImage, clearImages } from './images.js';
import { getDriveId, setDriveId, clearDriveIds } from './photo-map.js';

const STATE_KEY = 'ojt-sync-state', OWNER_KEY = 'ojt-sync-owner';
const OLD_STAMP = '2000-01-01T00:00:00.000Z';                       // data from before sync: the cloud copy wins
const CONFLICT = { settings: 'user_id', days: 'user_id,day', reports: 'user_id,week' };
const FORM_PAGES = /\/(log|edit-day|settings)\.html$/;              // never reload a page someone may be typing on

const emptyState = () => ({ stamps: {}, dirty: [], cursors: {} });
function load() {
  try { return { ...emptyState(), ...JSON.parse(localStorage.getItem(STATE_KEY)) }; }
  catch (e) { return emptyState(); }
}
const save = state => localStorage.setItem(STATE_KEY, JSON.stringify(state));
const makeId = (table, key) => `${table}:${key}`;
const splitId = id => { const at = id.indexOf(':'); return [id.slice(0, at), id.slice(at + 1)]; };

function mark(state, id, stamp) {
  state.stamps[id] = stamp;
  if (!state.dirty.includes(id)) state.dirty.push(id);
}

function allIds() {
  const keys = store.syncKeys();
  return Object.keys(keys).flatMap(table => keys[table].map(key => makeId(table, key)));
}

// ---- turning app data into database rows and back ----
function toRow(table, key, userId, stamp) {
  const value = store.syncValue(table, key);
  if (table === 'settings') return { user_id: userId, data: value, updated_at: stamp };
  if (table === 'days') return { user_id: userId, day: key, data: value || {}, deleted: !value, updated_at: stamp };
  return value ? { user_id: userId, week: key, body: value.text, generated_at: value.generatedAt, updated_at: stamp } : null;
}

function fromRow(table, row) {
  if (table === 'settings') return { key: 'me', value: row.data };
  if (table === 'days') return { key: row.day, value: row.deleted ? null : row.data };
  return { key: row.week, value: { text: row.body, generatedAt: Number(row.generated_at) } };
}

// ---- first sign-in on this device, or a different account ----
async function claimDevice(user) {
  const owner = localStorage.getItem(OWNER_KEY);
  if (owner === user.id) return false;
  if (owner) {                                                       // another account used this device: keep them apart
    store.resetLocal();
    await clearImages();
    clearDriveIds();
    save(emptyState());
    localStorage.removeItem(STATUS_KEY);
    localStorage.setItem(OWNER_KEY, user.id);
    return true;
  }
  const state = load();                                              // first sign-in: offer what is already here
  for (const id of allIds()) if (!state.stamps[id]) mark(state, id, OLD_STAMP);
  save(state);
  localStorage.setItem(OWNER_KEY, user.id);
  return false;
}

// ---- download changes ----
const sinceOf = (state, table) => state.cursors[table] || '1970-01-01T00:00:00.000Z';
const nextCursor = rows => new Date(Date.parse(rows[rows.length - 1].server_at) - 10000).toISOString(); // small overlap, so nothing is missed

async function pull() {
  let changed = false;
  for (const table of Object.keys(CONFLICT)) {
    const { data: rows, error } = await sb.from(table).select('*').gt('server_at', sinceOf(load(), table)).order('server_at', { ascending: true });
    if (error) throw error;
    const state = load();
    for (const row of rows) {
      const { key, value } = fromRow(table, row);
      const id = makeId(table, key);
      const remote = Date.parse(row.updated_at), local = state.stamps[id] ? Date.parse(state.stamps[id]) : 0;
      const isDirty = state.dirty.includes(id);
      if (remote < local || (remote === local && !isDirty)) continue; // this device already has the same or a newer copy
      store.applyRemote(table, key, value);
      state.stamps[id] = row.updated_at;
      state.dirty = state.dirty.filter(x => x !== id);
      changed = true;
    }
    if (rows.length) state.cursors[table] = nextCursor(rows);
    save(state);
  }

  const { data: photos, error } = await sb.from('photos').select('id, drive_file_id, server_at').gt('server_at', sinceOf(load(), 'photos')).order('server_at', { ascending: true });
  if (error) throw error;
  photos.forEach(photo => setDriveId(photo.id, photo.drive_file_id));
  if (photos.length) { const state = load(); state.cursors.photos = nextCursor(photos); save(state); }
  return changed;
}

// ---- upload changes ----
async function push(user) {
  const snapshot = load();
  for (const table of Object.keys(CONFLICT)) {
    const ids = snapshot.dirty.filter(id => splitId(id)[0] === table);
    if (!ids.length) continue;
    const rows = ids.map(id => toRow(table, splitId(id)[1], user.id, snapshot.stamps[id])).filter(Boolean);
    if (rows.length) {
      const { error } = await sb.from(table).upsert(rows, { onConflict: CONFLICT[table] });
      if (error) throw error;
    }
    const state = load();                                            // anything edited during the upload stays queued
    state.dirty = state.dirty.filter(id => !ids.includes(id) || state.stamps[id] !== snapshot.stamps[id]);
    save(state);
  }
}

async function uploadPhotos(user) {
  if (!(await ensureDriveToken())) return;                                      // queued until Drive is connected
  for (const id of new Set(store.usedImageIds())) {
    if (getDriveId(id)) continue;
    const record = await getLocalImage(id);
    if (!record) continue;
    const driveId = await uploadImage(record);
    const { error } = await sb.from('photos').upsert({ user_id: user.id, id, drive_file_id: driveId, name: record.name }, { onConflict: 'user_id,id' });
    if (error) throw error;
    setDriveId(id, driveId);
  }
}

// ---- status shown in Settings ----
const STATUS_KEY = 'ojt-sync-status';
const readStatus = () => { try { return JSON.parse(localStorage.getItem(STATUS_KEY)) || {}; } catch (e) { return {}; } };
const announceStatus = () => window.dispatchEvent(new Event('ojt-sync-status'));
function setStatus(change) {
  localStorage.setItem(STATUS_KEY, JSON.stringify({ ...readStatus(), ...change }));
  announceStatus();
}
export const getSyncStatus = () => ({ ...readStatus(), syncing: !!running });

// ---- running it ----
async function run() {
  const user = await getUser();
  if (!user || navigator.onLine === false) return false;
  const claimed = await claimDevice(user);
  const changed = await pull();
  await push(user);
  setStatus({ lastSync: Date.now(), failed: false });
  try {
    await uploadPhotos(user);
    setStatus({ photosFailed: false });
  } catch (e) {                                                      // logs are safe; photos stay queued for the next sync
    console.warn('Photos will retry later:', e.message);
    setStatus({ photosFailed: true });
  }
  return claimed || changed;
}

let running = null;
export function syncNow() {
  if (!running) {
    running = run()
      .catch(e => { console.warn('Sync will retry later:', e.message); setStatus({ failed: true }); return false; })
      .finally(() => { running = null; announceStatus(); });
    announceStatus();
  }
  return running;
}

async function syncAndRefresh() {
  if ((await syncNow()) && !FORM_PAGES.test(location.pathname)) location.reload();
}

let timer = null;
function onLocalChange(table, key) {
  const state = load(), stamp = new Date().toISOString();
  if (table === 'all') {                                             // a restored backup replaces everything
    for (const id of new Set([...Object.keys(state.stamps), ...allIds()])) mark(state, id, stamp);
  } else {
    mark(state, makeId(table, key), stamp);
  }
  save(state);
  clearTimeout(timer);
  timer = setTimeout(syncNow, 800);
}

export function startSync() {
  store.setSyncListener(onLocalChange);
  window.addEventListener('online', syncAndRefresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncAndRefresh(); });
  return syncAndRefresh();
}