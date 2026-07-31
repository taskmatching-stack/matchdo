/**
 * L4 Store bundle 專用 — 原生相機／相簿／IAP／Share 橋接（待實作）。
 * 勿加入線上 promo-camera-app.html。
 * 見 docs/PLAN-promo-camera-capacitor-app.md §1A
 */
(function () {
  'use strict';

  if (!window.MatchdoPromoCameraApp || !window.MatchdoPromoCameraApp.isNativeShell()) return;

  window.MatchdoPromoCameraNative = {
    ready: false
  };
})();
