# OJT Tracker (HTML + CSS design)

One HTML file per screen, plus JavaScript that saves data on the device (localStorage):

- `index.html` - Dashboard (progress, weekly chart, floating "Log today" button)
- `log.html` - Log today (time in/out, notes, submit)
- `history.html` - History (list of days)
- `edit-day.html` - Edit one day (opened from history)
- `settings.html` - Settings

Shared CSS:

- `css/tokens.css` - colors, spacing, sizes (variables)
- `css/base.css` - reset and page basics
- `css/components.css` - reusable pieces (card, btn, field, chart...)
- `css/screens.css` - page layout, menu, floating button, responsive rules

The menu is copied into every page.

JavaScript:

- `util.js` - date/time/text helpers
- `calc.js` - hours, late, overtime, progress, estimated finish, validation
- `store.js` - saving and loading data (the offline "backend")
- `autosize.js` - text boxes grow with their text
- `theme-init.js` / `theme.js` - light/dark theme (init script runs in <head>)
- `pages/` - one script per page: `dashboard.js`, `log.js`, `history.js`, `edit-day.js`, `settings.js`

Modules need a web server.