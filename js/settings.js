// SETTINGS (settings.html): load and save the OJT details, work schedule and reminders.
// Reminders are only stored for now. Phone notifications come later with Capacitor.
import { $ } from '../util.js';
import { getSettings, saveSettings } from '../store.js';

const settings = getSettings();
const field = id => $('#' + id);

field('required-hours').value = settings.required;
field('company-name').value = settings.company;
field('official-time-in').value = settings.officialIn;
field('hours-per-day').value = settings.hoursPerDay;
field('days-per-week').value = settings.daysPerWeek;
field('remind-in-on').checked = settings.remind.in.on;
field('remind-in-time').value = settings.remind.in.time;
field('remind-out-on').checked = settings.remind.out.on;
field('remind-out-time').value = settings.remind.out.time;

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
