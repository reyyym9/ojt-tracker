// THEME: change the color theme while the app is open (used by the Settings page).
// Choices: "system" (follow the phone), "light", "dark".
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
