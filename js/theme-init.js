// Runs in <head> BEFORE the page is drawn, so dark mode never flashes white.
// Reads the saved choice ("light" / "dark"; nothing saved = follow the phone) and sets <html data-theme>.
(function () {
  var choice = null;
  try { choice = localStorage.getItem('ojt-diy-theme'); } catch (e) {}
  var dark = choice ? choice === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
