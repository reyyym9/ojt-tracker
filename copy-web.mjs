import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
const items = ['css', 'js', 'index.html', 'reports.html', 'report.html', 'log.html', 'history.html', 'edit-day.html', 'settings.html'];
for (const item of items) cpSync(item, `www/${item}`, { recursive: true });