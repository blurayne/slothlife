// Optional legal-imprint hook. Defaults to "no imprint" — the
// Impressum link stays hidden on every surface. Both deploy
// workflows (.github/workflows/deploy-pages.yml + deploy-vercel.yml)
// overwrite this file with the real value of the WEB_IMPRINT
// repo secret when set, at which point the Impressum link
// appears on the start screen and at the bottom of the
// settings panel and opens a German legal-imprint dialog
// rendering the secret's contents verbatim (monospace, line
// breaks preserved).
window.WEB_IMPRINT = '';
