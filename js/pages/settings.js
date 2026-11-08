// SETTINGS (settings.html): OJT details, work schedule, reminders, appearance, backup.
// Reminders are only stored for now. Phone notifications come later with Capacitor.
import { $, todayKey } from '../util.js';
import { getSettings, saveSettings, exportJSON, importJSON, usedImageIds } from '../store.js';
import { exportImages, importImages, pruneImages } from '../images.js';
import { getChoice, setChoice, getColor, setColor } from '../theme.js';
import { signIn, signOut, connectDrive, getUser, getDriveToken } from '../auth.js';

const settings = getSettings();
const field = id => $('#' + id);

// ---- load saved values into the form ----
field('required-hours').value = settings.required;
field('company-name').value = settings.company;
field('official-time-in').value = settings.officialIn;
field('hours-per-day').value = settings.hoursPerDay;
field('days-per-week').value = settings.daysPerWeek;
field('remind-in-on').checked = settings.remind.in.on;
field('remind-in-time').value = settings.remind.in.time;
field('remind-out-on').checked = settings.remind.out.on;
field('remind-out-time').value = settings.remind.out.time;

// ---- save button ----
$('form').addEventListener('submit', e => {
  e.preventDefault();
  saveSettings({
    required: Number(field('required-hours').value),
    company: field('company-name').value.trim(),
    officialIn: field('official-time-in').value,
    hoursPerDay: Number(field('hours-per-day').value),
    daysPerWeek: Number(field('days-per-week').value),
    remind: {
      in: { on: field('remind-in-on').checked, time: field('remind-in-time').value },
      out: { on: field('remind-out-on').checked, time: field('remind-out-time').value },
    },
  });
  const button = $('[type="submit"]');
  button.textContent = 'Saved!';
  setTimeout(() => { button.textContent = 'Save settings'; }, 1500);
});

// ---- appearance (mode + color): applies immediately, no need to press Save ----
field('theme-' + getChoice()).checked = true;
document.querySelectorAll('input[name="theme"]').forEach(radio => {
  radio.addEventListener('change', () => setChoice(radio.value));
});

field('color-' + getColor()).checked = true;
document.querySelectorAll('input[name="color"]').forEach(radio => {
  radio.addEventListener('change', () => setColor(radio.value));
});

// ---- backup ----
field('export-btn').addEventListener('click', async () => {
  const data = JSON.parse(exportJSON());
  data.images = await exportImages(); // photos are added to the backup as text
  const file = new File([JSON.stringify(data)], `ojt-backup-${todayKey()}.json`, { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

field('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (confirm('Replace all current data with this backup?')) {
    try {
      const text = await file.text();
      importJSON(text);                                      // days and settings
      await importImages(JSON.parse(text).images || []);     // photos
      await pruneImages(usedImageIds());
      alert('Backup restored.'); location.reload();
    }
    catch (err) { alert('That file is not a valid OJT backup.'); }
  }
  e.target.value = ''; // lets you pick the same file again later
});

// ---- account: Google sign-in and Drive connection ----
const showError = e => alert(e?.message || 'Something went wrong with Google. Please try again.');

async function renderAccount() {
  const user = await getUser();
  field('account-signed-out').hidden = !!user;
  field('account-signed-in').hidden = !user;
  if (!user) return;

  const name = user.user_metadata?.full_name || user.email;
  field('account-avatar').textContent = name.charAt(0).toUpperCase();
  field('account-name').textContent = name;
  field('account-email').textContent = user.email;

  const connected = !!getDriveToken();
  field('drive-status').textContent = connected ? 'Saving to Google Drive' : 'Drive not connected';
  field('connect-drive').textContent = connected ? 'Connected' : 'Connect';
  field('connect-drive').disabled = connected;
}

// Disables the button while Google is working, then redraws the card
async function runAccountAction(button, work) {
  button.disabled = true;
  try { await work(); }
  catch (e) { showError(e); }
  button.disabled = false;
  renderAccount();
}

field('google-sign-in').addEventListener('click', e => runAccountAction(e.currentTarget, signIn));
field('connect-drive').addEventListener('click', e => runAccountAction(e.currentTarget, connectDrive));
field('sign-out').addEventListener('click', e => runAccountAction(e.currentTarget, signOut));

renderAccount().catch(showError);
