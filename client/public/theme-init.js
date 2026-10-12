// Apply the saved/system theme before first paint (avoids a light flash in dark mode).
// Kept as a separate file so the server can use a strict Content-Security-Policy (no inline scripts).
(function () {
  try {
    var t = localStorage.getItem('theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
