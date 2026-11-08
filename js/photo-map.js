// Remembers which Google Drive file holds each photo
const KEY = 'ojt-drive-photos';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };

export const getDriveId = id => read()[id];
export const setDriveId = (id, driveId) => { const map = read(); map[id] = driveId; localStorage.setItem(KEY, JSON.stringify(map)); };
export const clearDriveIds = () => localStorage.removeItem(KEY);