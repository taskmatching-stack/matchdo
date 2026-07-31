/**
 * /promo-camera-app — PWA 加入主畫面引導（iOS 圖示步驟；Android 一鍵安裝）
 * 不載入 embed=design；不修改共用 index.js
 */
(function () {
  'use strict';

  if (!document.body || !document.body.classList.contains('pc-app-shell')) return;
  if (document.body.classList.contains('pc-embed-design')) return;

  var STORAGE_KEY = 'matchdo-pc-pwa-install-v1';
  var DISMISS_DAYS = 7;
  var deferredPrompt = null;
  var sheetEl = null;

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback != null ? fallback : key;
  }

  function isIosDevice() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function isIosBrowser() {
    if (!isIosDevice()) return false;
    return !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent || '');
  }

  function isIosNonSafari() {
    return isIosDevice() && !isIosBrowser();
  }

  function isStandalone() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    return !!window.navigator.standalone;
  }

  function storageBlocked() {
    try {
      localStorage.setItem(STORAGE_KEY, 'test');
      localStorage.removeItem(STORAGE_KEY);
      return false;
    } catch (e) {
      return true;
    }
  }

  function shouldShow() {
    if (isStandalone()) return false;
    if (storageBlocked()) return true;
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'never') return false;
    if (raw === 'dismissed') {
      var ts = parseInt(localStorage.getItem(STORAGE_KEY + ':ts') || '0', 10);
      if (ts && Date.now() - ts < DISMISS_DAYS * 86400000) return false;
    }
    return isIosDevice() || !!deferredPrompt;
  }

  function markDismissed() {
    try {
      localStorage.setItem(STORAGE_KEY, 'dismissed');
      localStorage.setItem(STORAGE_KEY + ':ts', String(Date.now()));
    } catch (e) { /* ignore */ }
  }

  function markNever() {
    try {
      localStorage.setItem(STORAGE_KEY, 'never');
    } catch (e) { /* ignore */ }
  }

  function hideSheet() {
    if (!sheetEl) return;
    sheetEl.classList.add('d-none');
    document.body.classList.remove('pc-pwa-install-open');
  }

  function applyI18n() {
    if (!sheetEl) return;
    var title = sheetEl.querySelector('[data-pwa-i18n="title"]');
    var s1 = sheetEl.querySelector('[data-pwa-i18n="ios1"]');
    var s2 = sheetEl.querySelector('[data-pwa-i18n="ios2"]');
    var androidBtn = sheetEl.querySelector('[data-pwa-i18n="androidBtn"]');
    var later = sheetEl.querySelector('[data-pwa-i18n="later"]');
    var never = sheetEl.querySelector('[data-pwa-i18n="never"]');
    var safariHint = sheetEl.querySelector('[data-pwa-i18n="iosSafari"]');
    if (title) title.textContent = t('promoCamera.pwaInstallTitle', '加入主畫面，像 App 一樣使用');
    if (s1) s1.textContent = t('promoCamera.pwaInstallIosStep1', '1. 點 Safari 底部分享按鈕');
    if (s2) s2.textContent = t('promoCamera.pwaInstallIosStep2', '2. 選「加入主畫面」');
    if (safariHint) safariHint.textContent = t('promoCamera.pwaInstallIosSafariHint', '請用 Safari 開啟此頁，才能加入主畫面');
    if (androidBtn) androidBtn.textContent = t('promoCamera.pwaInstallAndroidBtn', '安裝到主畫面');
    if (later) later.textContent = t('promoCamera.pwaInstallLater', '稍後');
    if (never) never.textContent = t('promoCamera.pwaInstallNever', '不再提示');
  }

  function buildSheet() {
    if (sheetEl) return sheetEl;
    sheetEl = document.createElement('div');
    sheetEl.id = 'pcPwaInstallSheet';
    sheetEl.className = 'pc-pwa-install-sheet d-none';
    sheetEl.setAttribute('role', 'dialog');
    sheetEl.setAttribute('aria-live', 'polite');
    sheetEl.innerHTML =
      '<div class="pc-pwa-install-card">' +
      '  <div class="pc-pwa-install-title" data-pwa-i18n="title"></div>' +
      '  <p class="pc-pwa-install-safari-hint d-none mb-2 small text-muted" data-pwa-i18n="iosSafari"></p>' +
      '  <ol class="pc-pwa-install-steps pc-pwa-install-ios">' +
      '    <li data-pwa-i18n="ios1"></li>' +
      '    <li data-pwa-i18n="ios2"></li>' +
      '  </ol>' +
      '  <button type="button" class="btn btn-primary w-100 pc-pwa-install-android d-none" data-pwa-i18n="androidBtn"></button>' +
      '  <div class="pc-pwa-install-actions">' +
      '    <button type="button" class="btn btn-sm btn-link pc-pwa-install-later" data-pwa-i18n="later"></button>' +
      '    <button type="button" class="btn btn-sm btn-link text-muted pc-pwa-install-never" data-pwa-i18n="never"></button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(sheetEl);

    sheetEl.querySelector('.pc-pwa-install-later').addEventListener('click', function () {
      markDismissed();
      hideSheet();
    });
    sheetEl.querySelector('.pc-pwa-install-never').addEventListener('click', function () {
      markNever();
      hideSheet();
    });
    sheetEl.querySelector('.pc-pwa-install-android').addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        hideSheet();
      });
    });
    applyI18n();
    return sheetEl;
  }

  function showSheet() {
    if (!shouldShow()) return;
    buildSheet();
    var iosBlock = sheetEl.querySelector('.pc-pwa-install-ios');
    var safariHint = sheetEl.querySelector('.pc-pwa-install-safari-hint');
    var androidBtn = sheetEl.querySelector('.pc-pwa-install-android');
    if (isIosDevice()) {
      if (iosBlock) iosBlock.classList.remove('d-none');
      if (androidBtn) androidBtn.classList.add('d-none');
      if (safariHint) {
        if (isIosNonSafari()) safariHint.classList.remove('d-none');
        else safariHint.classList.add('d-none');
      }
      if (isIosNonSafari() && iosBlock) iosBlock.classList.add('d-none');
    } else if (deferredPrompt) {
      if (iosBlock) iosBlock.classList.add('d-none');
      if (androidBtn) androidBtn.classList.remove('d-none');
    } else {
      return;
    }
    sheetEl.classList.remove('d-none');
    document.body.classList.add('pc-pwa-install-open');
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (shouldShow()) showSheet();
  });

  document.addEventListener('matchdo-i18n-applied', applyI18n);

  function boot() {
    if (isIosDevice() && shouldShow()) {
      window.setTimeout(showSheet, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
