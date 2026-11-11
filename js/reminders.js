// REMINDERS: daily "time in" and "time out" notifications, only in the Android app.
// Settings saves the times; this file turns them into repeating notifications on the phone.
// Tapping a reminder opens Log today.
const notifications = window.Capacitor?.Plugins?.LocalNotifications;
export const remindersSupported = !!notifications;

const BASE_ID = { in: 100, out: 200 };                               // one notification per kind and weekday: 101-107, 201-207
const MESSAGES = {
  in: { title: 'Time to time in', body: 'Open OJT Tracker to log your time in.' },
  out: { title: 'Time to time out', body: "Log your time out and add today's tasks." },
};
const ALL_IDS = [1, 2, 3, 4, 5, 6, 7].flatMap(weekday => [BASE_ID.in + weekday, BASE_ID.out + weekday]);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Work days start on Monday: 5 days = Monday to Friday, 6 = Monday to Saturday, 7 = every day.
// Weekday numbers follow the plugin: 1 = Sunday ... 7 = Saturday.
export const workDays = daysPerWeek => [2, 3, 4, 5, 6, 7, 1].slice(0, Math.min(7, Math.max(1, Math.round(Number(daysPerWeek)) || 5)));

export function workDaysText(daysPerWeek) {
  const days = workDays(daysPerWeek).map(weekday => DAY_NAMES[weekday - 1]);
  if (days.length === 7) return 'every day';
  return days.length === 1 ? `on ${days[0]}` : `${days[0]} to ${days[days.length - 1]}`;
}

const isTime = value => /^\d{2}:\d{2}$/.test(value || '');

// Replaces the scheduled reminders with the ones in `settings`.
// Returns 'unsupported', 'off', 'denied' (notifications blocked) or 'on'.
export async function applyReminders(settings, { ask = false } = {}) {
  if (!notifications) return 'unsupported';
  await notifications.cancel({ notifications: ALL_IDS.map(id => ({ id })) });
  const kinds = ['in', 'out'].filter(kind => settings.remind[kind].on && isTime(settings.remind[kind].time));
  if (!kinds.length) return 'off';

  let { display } = await notifications.checkPermissions();
  if (display !== 'granted' && ask) ({ display } = await notifications.requestPermissions());
  if (display !== 'granted') return 'denied';

  await notifications.schedule({
    notifications: kinds.flatMap(kind => {
      const [hour, minute] = settings.remind[kind].time.split(':').map(Number);
      return workDays(settings.daysPerWeek).map(weekday => ({
        id: BASE_ID[kind] + weekday,
        ...MESSAGES[kind],
        schedule: { on: { weekday, hour, minute }, allowWhileIdle: true },
      }));
    }),
  });
  return 'on';
}

// Android 12+ can delay reminders unless "Alarms & reminders" is allowed for the app
export async function exactAlarmsAllowed() {
  if (!notifications?.checkExactNotificationSetting) return true;
  try { return (await notifications.checkExactNotificationSetting()).exact_alarm === 'granted'; }
  catch (e) { return true; }                                         // older Android: always exact
}
export const openExactAlarmSetting = () => notifications?.changeExactNotificationSetting?.();

// Runs on every page: tapping a reminder opens Log today, and the reminders are refreshed once per app start
export function startReminders(settings) {
  if (!notifications) return;
  notifications.addListener('localNotificationActionPerformed', () => {
    if (!location.pathname.endsWith('log.html')) location.href = 'log.html';
  });
  if (sessionStorage.getItem('ojt-reminders-ready')) return;
  sessionStorage.setItem('ojt-reminders-ready', '1');
  applyReminders(settings).catch(() => {});
}
