// SETTINGS (settings.html): OJT details, work schedule, reminders, appearance, backup.
// Reminders are only stored for now. Phone notifications come later with Capacitor.
import { $, todayKey } from '../util.js';
import { getSettings, saveSettings, exportJSON, importJSON, usedImageIds } from '../store.js';
import { exportImages, importImages, pruneImages } from '../images.js';
import { getChoice, setChoice, getColor, setColor } from '../theme.js';
import { signIn, signOut, connectDrive, finishDriveConnect, getUser, ensureDriveToken } from '../auth.js';
import { syncNow, getSyncStatus } from '../sync.js';

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

  const connected = !!(await ensureDriveToken());
  field('drive-status').textContent = connected ? 'Saving to Google Drive' : 'Drive not connected';
  field('connect-drive').textContent = connected ? 'Connected' : 'Connect';
  field('connect-drive').disabled = connected;
  renderSyncStatus();
}

// "just now", "2 mins ago", "3 hrs ago", "1 day ago"
function timeAgo(time) {
  const unit = (count, name) => `${count} ${name}${count > 1 ? 's' : ''} ago`;
  const mins = Math.floor((Date.now() - time) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return unit(mins, 'min');
  const hours = Math.floor(mins / 60);
  return hours < 24 ? unit(hours, 'hr') : unit(Math.floor(hours / 24), 'day');
}

function renderSyncStatus() {
  const status = getSyncStatus();
  const last = status.lastSync ? `Last synced ${timeAgo(status.lastSync)}` : 'Not synced yet';
  let text = last;
  if (status.syncing) text = 'Syncing...';
  else if (navigator.onLine === false) text = `Offline. ${last}`;
  else if (status.failed) text = `Couldn't sync. Will try again. ${last}`;
  else if (status.photosFailed) text = `${last}. Some photos are waiting to upload`;
  field('sync-status').textContent = text;
}

['ojt-sync-status', 'online', 'offline'].forEach(name => window.addEventListener(name, renderSyncStatus));
setInterval(renderSyncStatus, 30000); // keeps "2 mins ago" up to date

// Disables the button while Google is working, then redraws the card
async function runAccountAction(button, work) {
  button.disabled = true;
  try { await work(); }
  catch (e) { showError(e); }
  button.disabled = false;
  renderAccount();
  if (await syncNow()) location.reload();
}

field('google-sign-in').addEventListener('click', e => runAccountAction(e.currentTarget, signIn));
field('connect-drive').addEventListener('click', e => runAccountAction(e.currentTarget, connectDrive));
field('sign-out').addEventListener('click', e => runAccountAction(e.currentTarget, signOut));

finishDriveConnect().catch(showError).then(renderAccount).catch(showError).then(syncNow).then(changed => { if (changed) location.reload(); });
