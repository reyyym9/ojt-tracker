// IMAGES: photos are kept in IndexedDB (a database inside the browser/phone, works offline).
// localStorage is too small for pictures. Each day only stores the ids of its photos.

import { driveFetch, getDriveToken } from './auth.js';
import { getDriveId } from './photo-map.js';

const DB_NAME = 'ojt-diy-images', STORE = 'images';

const open = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

// Runs `work(store)` in one transaction. If work returns a request, its result is handed back.
async function withStore(mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request && request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));

export async function saveImage(blob, name) {
  const id = newId();
  await withStore('readwrite', store => store.put({ id, name, blob, created: Date.now() }));
  return id;
}

export const getLocalImage = id => withStore('readonly', store => store.get(id));
export const clearImages = () => withStore('readwrite', store => { store.clear(); });

// Looks on this device first, then downloads the photo from Google Drive
export async function getImage(id) {
  const local = await getLocalImage(id);
  if (local) return local;
  const driveId = getDriveId(id);
  if (!driveId || !getDriveToken()) return undefined;
  try {
    const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media`);
    if (!response.ok) return undefined;
    const record = { id, name: 'photo', blob: await response.blob(), created: Date.now() };
    await withStore('readwrite', store => store.put(record));
    return record;
  } catch (e) { return undefined; }
}

export async function uploadImage(record) {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: `${record.id}.jpg`, parents: ['appDataFolder'] })], { type: 'application/json' }));
  form.append('file', record.blob);
  const response = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Drive upload failed (${response.status})`);
  return (await response.json()).id;
}

export const deleteImages = ids => withStore('readwrite', store => { ids.forEach(id => store.delete(id)); });

// Removes photos that no saved day uses (for example, added but never submitted)
export async function pruneImages(keepIds) {
  const keep = new Set(keepIds);
  const all = await withStore('readonly', store => store.getAllKeys());
  await deleteImages(all.filter(id => !keep.has(id)));
}

// Shrinks a photo to max 1280px, JPEG: a phone picture of 4 MB becomes about 200 KB
export async function compress(file, maxSide = 1280, quality = 0.75) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // transparent PNGs get a white background
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('compress failed'))), 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}

// ---- backup helpers: photos travel inside the backup file as text (data URLs) ----
const toDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});
export async function exportImages() {
  const all = await withStore('readonly', store => store.getAll());
  return Promise.all(all.map(async r => ({ id: r.id, name: r.name, dataUrl: await toDataUrl(r.blob) })));
}
export async function importImages(list) {
  for (const item of list) {
    if (!item || typeof item.dataUrl !== 'string' || !item.dataUrl.startsWith('data:image/')) continue; // skip anything that is not a picture
    const blob = await (await fetch(item.dataUrl)).blob();
    await withStore('readwrite', store => store.put({ id: String(item.id), name: String(item.name || 'photo'), blob, created: Date.now() }));
  }
}
