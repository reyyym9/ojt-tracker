# OJT Tracker (HTML + CSS design)
# OJT Tracker

One HTML file per screen, plus JavaScript that saves data on the device (localStorage):
Track OJT hours, daily notes, photos and weekly reports. The app works offline on each device. Signing in with Google syncs your logs, notes, reports and settings through Supabase, and stores your photos in your own Google Drive.

- **Website (and iPhone):** https://reyyym9.github.io/ojt-tracker/
- **Android:** download the APK from https://github.com/reyyym9/ojt-tracker/releases/latest

An iPhone cannot install an APK, so iPhone users open the website in any browser.

## Pages

One HTML file per screen:

- `index.html` - Dashboard (progress, weekly chart, floating "Log today" button)
- `reports.html` - Report tab: one row per week with logs
- `report.html` - one weekly report (opened from the dashboard or the Report tab)
- `log.html` - Log today (time in/out, notes, submit)
- `history.html` - History (list of days)
- `log.html` - Log today (time in/out, notes, photos, submit)
- `history.html` - History (list of days, or a calendar)
- `edit-day.html` - Edit one day (opened from history)
- `settings.html` - Settings
- `settings.html` - Settings, Google sign-in and Google Drive connection

The menu is copied into every page. On phones it is a bottom bar, and from 768px up it becomes a left sidebar.

Shared CSS:
## CSS

- `css/tokens.css` - colors, spacing, sizes (variables); the default teal theme
- `css/themes.css` - the other color themes (Coral, Sand, Sage, Rose, Indigo, Cocoa, Neutral), each for light and dark
- `css/base.css` - reset and page basics
- `css/components.css` - reusable pieces (card, btn, field, chart...)
- `css/screens.css` - page layout, menu, floating button, responsive rules

The menu is copied into every page.
## JavaScript

JavaScript (ES modules, in `js/`):
ES modules in `js/`, with no build step:

- `util.js` - date/time/text helpers
- `calc.js` - hours, late, overtime, progress, estimated finish, validation
- `store.js` - saving and loading data (the offline "backend")
- `images.js` / `photos.js` - photos in IndexedDB and the photo picker
- `store.js` - saving and loading data on the device (localStorage); tells `sync.js` about changes
- `images.js` / `photos.js` - photos in IndexedDB, Google Drive upload/download, and the photo picker
- `config.js` - public project settings (Supabase URL, publishable key, Google web client ID)
- `auth.js` - Google sign-in (browser and Android) and the Google Drive token
- `sync.js` - background sync with Supabase and Google Drive
- `photo-map.js` - remembers which Google Drive file holds each photo
- `vendor/supabase.js` - local copy of the Supabase library, so the app still opens offline
- `report-writer.js` - builds the weekly report text (one paragraph per day)
- `autosize.js` - text boxes grow with their text
- `theme-init.js` / `theme.js` - light/dark theme (init script runs in <head>)
- `pages/` - one script per page (history.js also draws the calendar; report.js is the script of report.html): `dashboard.js`, `log.js`, `history.js`, `edit-day.js`, `settings.js`
- `pages/` - one script per page (history.js also draws the calendar; report.js is the script of report.html): `dashboard.js`, `log.js`, `history.js`, `edit-day.js`, `settings.js`, `reports.js`, `report.js`

## How sync works

- Every change is saved on the device first, then queued and sent to Supabase.
- Devices download changes when a page opens or when you return to the app, so updates are not instant while two devices are open.
- If two devices edit the same day, the newest edit wins.
- Logs and notes sync after sign-in. Photos also need **Connect** in Settings, once per session.
- Photos go to a hidden app folder in the user's Google Drive. They count toward that user's storage, but do not appear in My Drive.
- Signing in with a different Google account on a device clears that device's copy. Anything already synced stays in the cloud.

Known limits:

- Removing a photo does not delete its copy from Google Drive yet.
- Restoring a backup does not remove weekly reports from other devices.

## Run it locally

Modules need a web server, so opening a file by double-click will not work.

1. Open the project with VS Code Live Server.
2. Use `http://localhost:5500`, not `127.0.0.1`. Google sign-in only accepts `localhost`.
3. Use the browser's phone view (F12) to check the mobile layout.

## Services

- **Supabase:** Google sign-in and the `settings`, `days`, `reports` and `photos` tables, each protected with row level security.
- **Google Cloud:** the Google Drive API, the `drive.appdata` scope, one web OAuth client and two Android OAuth clients (debug and release SHA-1).
- **GitHub Pages:** hosts the website from the `main` branch.
