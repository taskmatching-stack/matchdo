/**
 * L4 Store bundle 專用 — 勿加入線上 promo-camera-app.html。
 * 見 docs/PLAN-promo-camera-app-isolation-layer.md
 */
(function () {
  'use strict';

  if (!document.body || !document.body.classList.contains('pc-app-shell')) return;

  window.__MATCHDO_PROMO_CAMERA_CHANNEL = 'app';

  window.MatchdoPromoCameraApp = {
    channel: 'app',
    isNativeShell: function () {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }
  };
})();
