// Apply language before rendering without an inline script, so strict CSP can allow it.
// Same rule as initialLang() in src/i18n/format.ts: the saved choice; otherwise Persian on a device that already holds
// a learner's data (they used the app when Persian was the default); otherwise English. The choice is saved once.
try {
  var lang = localStorage.getItem('daf_lang');
  if (lang !== 'fa' && lang !== 'en') {
    lang = Object.keys(localStorage).some(function (k) { return k.indexOf('daf_cards_cache_') === 0; }) ? 'fa' : 'en';
    localStorage.setItem('daf_lang', lang);
  }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
} catch { /* Storage can be unavailable. The app keeps its default language (English). */ }
