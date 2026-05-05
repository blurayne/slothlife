// Version stamp. Defaults are used for local development; the deploy
// workflows (.github/workflows/deploy-pages.yml + deploy-vercel.yml)
// overwrite this file with real values before deploying.
//   APP_ENV     — GitHub Actions deploy environment name
//                 ('github-pages', 'vercel-convex', …); empty in dev.
//   APP_VERSION — github.ref_name; only displayed when it parses as
//                 a semantic version (so 'main' / 'dev' are hidden).
window.APP_ENV     = '';
window.APP_VERSION = 'dev';
window.APP_BUILD   = '0';
window.APP_DATE    = 'local';
window.APP_SHA     = 'unknown';
