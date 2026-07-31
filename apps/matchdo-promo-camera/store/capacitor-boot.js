/**
 * Capacitor Store bundle 專用 — 僅存在 www/store/（sync 產生，不掛線上 PWA）。
 * 設定 API 原點並改寫 fetch，使 file/capacitor 協議下仍可打 matchdo.cc API。
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://matchdo.cc';

  window.__MATCHDO_API_ORIGIN = API_ORIGIN;
  window.__MATCHDO_PROMO_CAMERA_DISTRIBUTION = 'capacitor';

  if (typeof window.fetch !== 'function') return;

  var nativeFetch = window.fetch.bind(window);

  function resolveFetchUrl(input) {
    if (typeof input !== 'string') return input;
    if (input.indexOf('/api/') === 0) return API_ORIGIN + input;
    if (input.indexOf('/locales/') === 0) return input.slice(1);
    return input;
  }

  window.fetch = function (input, init) {
    if (typeof input === 'string') {
      return nativeFetch(resolveFetchUrl(input), init);
    }
    if (input && typeof input.url === 'string') {
      var resolved = resolveFetchUrl(input.url);
      if (resolved !== input.url) {
        return nativeFetch(new Request(resolved, input), init);
      }
    }
    return nativeFetch(input, init);
  };
})();
