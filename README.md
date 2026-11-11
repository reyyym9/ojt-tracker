# OJT Tracker

Track your on-the-job training in one place: daily time in and out, notes, photos, progress toward your required hours, and weekly narrative reports ready to submit.

It works offline on every device. Sign in with Google to keep your records in sync across your phone and computer, with your photos saved in your own Google Drive.

| | |
|---|---|
| **Website and iPhone** | [reyyym9.github.io/ojt-tracker](https://reyyym9.github.io/ojt-tracker/) |
| **Android app** | [Download the latest APK](https://github.com/reyyym9/ojt-tracker/releases/latest) |
| **Privacy policy** | [Read it here](https://reyyym9.github.io/ojt-tracker/privacy.html) |

> iPhones can't install APK files, so iPhone users open the website in Safari.

---

## Features

**Daily logging**
- Time in and out as morning and afternoon sessions, or as one whole day
- Late and overtime tracking against your official time and hours per day
- Daily notes: tasks done, challenges, and how you handled them
- Photos for each day, with an optional description for each one

**Progress**
- Dashboard with your progress, hours left, days left and estimated finish date
- Weekly hours chart with your daily target
- History as a list or a calendar, with week numbers

**Weekly reports**
- A draft narrative written automatically from your notes, with no times or hours
- A free academic version: copy a ready-made prompt into Claude and paste the answer back
- Download as a Word file (Times New Roman, justified, with your photos) or as plain text

**Everywhere you go**
- Sync across devices with Google sign-in
- Photos stored in a hidden app folder in your own Google Drive, connected once
- Time in and time out reminders in the Android app
- Light and dark mode with eight color themes
- Works offline, and backups can be exported and imported

---

## Using the app

1. **Set up:** open **Settings** and enter your required hours, company, official time in, hours per day and days per week.
2. **Sign in:** tap **Sign in with Google**, then **Connect** next to Photo storage to save photos to Drive.
3. **Log each day:** tap **+ Log today**, record your times, and add your tasks and photos when you time out.
4. **Write your report:** open the **Report** tab, pick a week, and follow the steps to create the academic version.
5. **Turn on reminders (Android):** in Settings, switch on Time in or Time out and allow notifications. Changes save right away.

---

## How sync works

- Every change is saved on your device first, then sent to the cloud in the background.
- Other devices pick up changes when a page opens or when you return to the app.
- If two devices edit the same day, the newest edit wins.
- Photos are uploaded to a hidden folder in your Google Drive. They count toward your Drive storage but don't appear in My Drive.
- Signing in with a different Google account on a device clears that device's copy. Anything already synced stays safe in the cloud.

**Known limits**
- Removing a photo doesn't delete its copy from Google Drive yet.
- Restoring a backup doesn't remove weekly reports from your other devices.
- Reminders ring only in the Android app, and a time-in reminder still rings on days you've already logged.

---

## Built with

| Part | Technology |
|---|---|
| App | Plain HTML, CSS and JavaScript modules, with no build step |
| Android | [Capacitor](https://capacitorjs.com/), with plugins for Google sign-in, notifications, files and sharing |
| Accounts and sync | [Supabase](https://supabase.com/): Google sign-in, database with row level security, and an Edge Function |
| Photo storage | Google Drive API, using the private `drive.appdata` folder |
| Word export | [docx](https://www.npmjs.com/package/docx) |
| Website hosting | GitHub Pages, from the `main` branch |

---

## Project structure

<details>
<summary><b>Pages</b></summary>

| File | Screen |
|---|---|
| `index.html` | Home: progress, weekly chart, this week's tasks and photos |
| `log.html` | Log today: times, notes and photos |
| `history.html` | History as a list or calendar |
| `edit-day.html` | Edit or delete one day |
| `reports.html` | Report tab: one row per week |
| `report.html` | One weekly report: draft, academic version, Word export and photos |
| `settings.html` | Settings, account, Drive, sync status, reminders, appearance and backup |
| `privacy.html` | Privacy policy |

The menu is repeated in every page. On phones it's a bottom bar, and from 768px wide it becomes a left sidebar.

</details>

<details>
<summary><b>JavaScript (<code>js/</code>)</b></summary>

| File | What it does |
|---|---|
| `store.js` | Saves and loads everything on the device, and tells `sync.js` about changes |
| `sync.js` | Background sync with Supabase and photo uploads to Drive |
| `auth.js` | Google sign-in for the website and Android, and Drive tokens |
| `config.js` | Public project settings: Supabase URL, publishable key and Google web client ID |
| `images.js` / `photos.js` | Photos on the device and in Drive, and the photo picker with descriptions |
| `photo-map.js` | Remembers which Drive file holds each photo |
| `report-writer.js` | Draft report, academic prompt, and saving the pasted answer |
| `reminders.js` | Schedules time in and time out notifications on Android |
| `calc.js` | Hours, late, overtime, progress and estimated finish |
| `util.js` | Date, time and text helpers |
| `autosize.js` | Text boxes that grow with their text |
| `theme-init.js` / `theme.js` | Light, dark and color themes |
| `pages/` | One script per page |
| `vendor/` | Local copies of the Supabase and docx libraries, so the app opens offline |

</details>

<details>
<summary><b>CSS (<code>css/</code>)</b></summary>

| File | What it holds |
|---|---|
| `tokens.css` | Colors, spacing and sizes for the default teal theme |
| `themes.css` | The other seven color themes, in light and dark |
| `base.css` | Reset and page basics |
| `components.css` | Reusable pieces: cards, buttons, fields, chart and more |
| `screens.css` | Page layout, menu and responsive rules |

</details>

<details>
<summary><b>Everything else</b></summary>

| Path | What it is |
|---|---|
| `sw.js` | Service worker that lets the website open offline |
| `manifest.webmanifest` / `icons/` | App name and icons for Add to Home Screen |
| `supabase/functions/drive-token/` | Edge Function that keeps Google Drive connected |
| `android/` | The Android project made by Capacitor |
| `copy-web.mjs` | Copies the website into `www/` for the Android app |

</details>

---

## Development

### Run it locally

Modules need a web server, so opening a file by double-clicking won't work.

1. Open the project in VS Code and start **Live Server**.
2. Use `http://localhost:5500`, not `127.0.0.1`, because Google sign-in only accepts `localhost`.
3. Press F12 and use the phone view to check the mobile layout.

The service worker stays off on `localhost`, so you always see your latest changes.

### Build the Android app

You need Node 22 or newer, Android Studio, and JDK 21 set as **Gradle JDK** in Android Studio.

```bash
npm install
node copy-web.mjs
npx cap sync android
npx cap open android
```

Run `node copy-web.mjs` and `npx cap sync android` again after every change to the website files.

### Release a new version

1. Change `VERSION` in `sw.js` so phones and browsers download the new files.
2. Increase `versionCode` and `versionName` in `android/app/build.gradle`.
3. Build the APK in Android Studio with **Build > Generate Signed App Bundle or APK**, using the same signing key as earlier releases.
4. Push to `main`, which updates the website.
5. Create a GitHub Release with a new tag and attach `android/app/release/app-release.apk`.

### Services setup

- **Supabase:** Google sign-in, the `settings`, `days`, `reports`, `photos` and `drive_tokens` tables with row level security, and the `drive-token` Edge Function.
- **Google Cloud:** the Google Drive API with the `drive.appdata` scope, one web OAuth client, and Android OAuth clients for the debug and release signing keys.
- **Edge Function secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `DRIVE_TOKEN_KEY`, set with `npx supabase secrets set`.

> Never commit the Google client secret, a Supabase secret key, Edge Function secrets, or the `.jks` signing key. The values in `js/config.js` are public by design.
