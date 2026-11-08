# OJT Tracker (HTML + CSS design)

One HTML file per screen, plus JavaScript that saves data on the device (localStorage):

- `index.html` - Dashboard (progress, weekly chart, floating "Log today" button)
- `reports.html` - Report tab: one row per week with logs
- `report.html` - one weekly report (opened from the dashboard or the Report tab)
- `log.html` - Log today (time in/out, notes, submit)
- `history.html` - History (list of days)
- `edit-day.html` - Edit one day (opened from history)
- `settings.html` - Settings

Shared CSS:

- `css/tokens.css` - colors, spacing, sizes (variables); the default teal theme
- `css/themes.css` - the other color themes (Coral, Sand, Sage, Rose, Indigo, Cocoa, Neutral), each for light and dark
- `css/base.css` - reset and page basics
- `css/components.css` - reusable pieces (card, btn, field, chart...)
- `css/screens.css` - page layout, menu, floating button, responsive rules

The menu is copied into every page. Open `index.html` with VS Code Live Server and use the browser's phone view (F12).

JavaScript (ES modules, in `js/`):

- `util.js` - date/time/text helpers
- `calc.js` - hours, late, overtime, progress, estimated finish, validation
- `store.js` - saving and loading data (the offline "backend")
- `images.js` / `photos.js` - photos in IndexedDB and the photo picker
- `report-writer.js` - builds the weekly report text (one paragraph per day)
- `autosize.js` - text boxes grow with their text
- `theme-init.js` / `theme.js` - light/dark theme (init script runs in <head>)
- `pages/` - one script per page (history.js also draws the calendar; report.js is the script of report.html): `dashboard.js`, `log.js`, `history.js`, `edit-day.js`, `settings.js`

Modules need a web server: use VS Code Live Server (opening the file by double-click will not work).
