// Runs in <head> BEFORE the page is drawn, so the saved look never flashes.
// Sets <html data-theme="light|dark"> (mode) and <html data-color="..."> (color theme).
(function () {
  var mode = null, color = null;
  try { mode = localStorage.getItem('ojt-diy-theme'); color = localStorage.getItem('ojt-diy-color'); } catch (e) {}
  var dark = mode ? mode === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.color = color || 'teal';
})();
