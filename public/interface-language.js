// Apply language before rendering without an inline script, so strict CSP can allow it.
try {
  if (localStorage.getItem('daf_lang') === 'en') {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }
} catch { /* Storage can be unavailable. The app keeps its default language. */ }
