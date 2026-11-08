// THEME: change the look while the app is open (used by the Settings page).
// Mode:  "system" (follow the phone), "light", "dark"   -> <html data-theme>
// Color: one of COLORS below                              -> <html data-color>  (colors are defined in css/themes.css)
const KEY = 'ojt-diy-theme';
const media = matchMedia('(prefers-color-scheme: dark)');

export const getChoice = () => { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } };

function apply() {
  const choice = getChoice();
  const dark = choice === 'system' ? media.matches : choice === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setChoice(choice) {
  try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch (e) {}
  apply();
}
media.addEventListener('change', apply); // the phone's own setting changed

// ---- color themes ----
export const COLORS = ['teal', 'coral', 'sand', 'sage', 'rose', 'indigo', 'cocoa', 'neutral'];
const COLOR_KEY = 'ojt-diy-color';

export const getColor = () => { try { const c = localStorage.getItem(COLOR_KEY); return COLORS.includes(c) ? c : 'teal'; } catch (e) { return 'teal'; } };

export function setColor(color) {
  try { localStorage.setItem(COLOR_KEY, color); } catch (e) {}
  document.documentElement.dataset.color = color;
}
