// Backend config. Defaults to "no backend" — frontend falls back to
// localStorage for highscores. The Vercel deploy workflow overwrites
// this file with the real CONVEX_URL when the corresponding GitHub
// Actions secret is set, at which point the frontend will use the
// Convex backend for shared highscores.
window.CONVEX_URL = '';
