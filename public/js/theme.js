// public/js/theme.js
//
// Handles light/dark theme switching. Loaded on ALL 7 pages,
// including index.html — that's why this logic lives in its own
// file instead of inside app.js. app.js checks for a login token
// and redirects to index.html if one isn't found, which would
// create a redirect loop if theme.js's logic were bundled into it
// and this ran on the login page itself.
//
// How theme switching actually works:
//   - The <html> element gets a data-theme="light" or
//     data-theme="dark" attribute.
//   - style.css has two sets of color variables: the default (light)
//     under :root, and overrides under :root[data-theme="dark"].
//   - So the ONLY job of this file is to set that one attribute,
//     and remember the choice for next time.
//
// A SEPARATE tiny inline script (in each HTML file's <head>, before
// this file loads) sets the attribute IMMEDIATELY on page load,
// before anything renders — otherwise the page would flash the
// light theme for a split second before this file finishes loading
// and switches it to dark. That inline script and this file share
// the same localStorage key ('theme') so they stay in sync.

function getStoredTheme() {
  return localStorage.getItem('theme');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateToggleButtonIcon(theme);
}

function updateToggleButtonIcon(theme) {
  // There can be a toggle button on this page, or not (some pages
  // might not have one yet) — check before touching it.
  const button = document.getElementById('theme-toggle');
  if (!button) return;

  // Simple text-symbol icons rather than an icon font/library —
  // keeps this dependency-free. Shows the icon for the theme you'd
  // SWITCH TO, which is the usual convention (a sun icon in dark
  // mode means "tap to go light").
  button.textContent = theme === 'dark' ? '☀️' : '🌙';
  button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function setupThemeToggleButton() {
  const button = document.getElementById('theme-toggle');
  if (!button) return;

  button.addEventListener('click', toggleTheme);

  // Make sure the icon matches whatever theme the inline
  // anti-flash script already applied before this file loaded.
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  updateToggleButtonIcon(currentTheme);
}

setupThemeToggleButton();