// UTIL: small helpers that know nothing about the app (dates, times, text).
export const $ = (selector, root = document) => root.querySelector(selector);
// Put text into the element marked data-bind="name" in the HTML
export const setText = (name, text) => { $(`[data-bind="${name}"]`).textContent = text; };

export const pad = n => String(n).padStart(2, '0');
export const keyOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; // "2026-11-03"
export const parseKey = key => new Date(key + 'T00:00');
export const todayKey = () => keyOf(new Date());
export const addDays = (key, n) => { const d = parseKey(key); d.setDate(d.getDate() + n); return keyOf(d); };
export const mondayOf = key => addDays(key, -((parseKey(key).getDay() + 6) % 7)); // weeks start on Monday

export const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }; // "08:30"
export const toMin = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };      // "08:30" -> 510
export const fmt = minutes => { const t = Math.round(minutes); return `${Math.floor(t / 60)}h ${pad(t % 60)}m`; }; // 485 -> "8h 05m"

export const longDate = key => parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export const shortDate = key => parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const monthShort = key => parseKey(key).toLocaleDateString(undefined, { month: 'short' });
export const weekday = key => parseKey(key).toLocaleDateString(undefined, { weekday: 'long' });
export const esc = text => (text || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const dayLabel = key => parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); // "Mon, Nov 2"
