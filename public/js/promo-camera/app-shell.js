/**
 * 僅 /promo-camera-app 載入 — 不修改共用 index.js 行為
 */
(function () {
  'use strict';

  if (!document.body || !document.body.classList.contains('pc-app-shell')) return;

  window.__MATCHDO_PROMO_CAMERA_APP_BUILD = 'promo-camera-app-20260802f';

  var Api = window.PromoCameraApi;
  var St = window.PromoCameraState;
  if (!Api || !St) return;

  var modalInstances = {};

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback != null ? fallback : key;
  }

  function getBootstrapModal(el) {
    if (!el || typeof bootstrap === 'undefined') return null;
    var id = el.id;
    if (!id) return new bootstrap.Modal(el);
    if (!modalInstances[id]) modalInstances[id] = new bootstrap.Modal(el);
    return modalInstances[id];
  }

  function showModal(el) {
    var m = getBootstrapModal(el);
    if (m) m.show();
  }

  function hideModal(el) {
    if (!el || !el.id || !modalInstances[el.id]) return;
    modalInstances[el.id].hide();
  }

  function showEl(el, visible) {
    if (!el) return;
    el.classList.toggle('d-none', !visible);
  }

  function getChatPanel() {
    return document.querySelector('#promo-camera-app .pc-chat-panel');
  }

  function scrollResultIntoView() {
    var el = document.getElementById('pcResultArea');
    if (!el || el.classList.contains('d-none')) return;
    requestAnimationFrame(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function observeResultArea() {
    var el = document.getElementById('pcResultArea');
    if (!el || typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function () {
      if (!el.classList.contains('d-none')) scrollResultIntoView();
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function updateComposeSummary() {
    var el = document.getElementById('pcComposeSummary');
    if (!el) return;
    var st = St.get();
    var parts = [];
    var themeEl = document.getElementById('pcThemeSelect');
    if (themeEl && themeEl.selectedIndex >= 0 && themeEl.options[themeEl.selectedIndex]) {
      var themeLabel = (themeEl.options[themeEl.selectedIndex].textContent || '').trim();
      if (themeLabel) parts.push(themeLabel);
    }
    var subjectEl = document.getElementById('pcPreserveSubjects');
    if (subjectEl && subjectEl.selectedIndex >= 0 && subjectEl.options[subjectEl.selectedIndex]) {
      var subjectLabel = (subjectEl.options[subjectEl.selectedIndex].textContent || '').trim();
      if (subjectLabel) parts.push(subjectLabel);
    }
    var ratio = (document.getElementById('pcRatioSelect') || {}).value || st.aspectRatio || '';
    if (ratio) parts.push(ratio);
    var mp = (document.getElementById('pcMpSelect') || {}).value || st.megapixels || '';
    if (mp) parts.push(mp + ' MP');
    if (!parts.length) {
      el.textContent = t('promoCamera.composeSummaryDefault', '點開調整');
      el.classList.add('is-placeholder');
    } else {
      el.textContent = parts.join(' · ');
      el.classList.remove('is-placeholder');
    }
  }

  function syncAppPickerLabels() {
    var themeEl = document.getElementById('pcThemeSelect');
    var sceneEl = document.getElementById('pcSceneSelect');
    var themeLabel = document.getElementById('pcThemePickerLabel');
    var sceneLabel = document.getElementById('pcScenePickerLabel');
    if (themeEl && themeLabel && themeEl.selectedIndex >= 0) {
      themeLabel.textContent = (themeEl.options[themeEl.selectedIndex].textContent || '').trim() || '—';
    }
    if (sceneEl && sceneLabel && sceneEl.selectedIndex >= 0) {
      sceneLabel.textContent = (sceneEl.options[sceneEl.selectedIndex].textContent || '').trim() || t('promoCamera.sceneNone', '（不選）');
    }
  }

  function renderAppPickerList(select, listEl) {
    if (!select || !listEl) return;
    listEl.innerHTML = '';
    if (!select.options.length) {
      var empty = document.createElement('div');
      empty.className = 'pc-app-picker-empty';
      empty.textContent = t('home.loading', '載入中…');
      listEl.appendChild(empty);
      return;
    }
    Array.prototype.forEach.call(select.options, function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pc-app-picker-item' + (opt.value === select.value ? ' is-selected' : '');
      btn.textContent = opt.textContent || opt.value;
      btn.addEventListener('click', function () {
        if (select.value !== opt.value) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        hideModal(document.getElementById('pcAppPickerModal'));
      });
      listEl.appendChild(btn);
    });
  }

  function openAppPicker(selectId, title) {
    var select = document.getElementById(selectId);
    var modalEl = document.getElementById('pcAppPickerModal');
    var listEl = document.getElementById('pcAppPickerList');
    var titleEl = document.getElementById('pcAppPickerTitle');
    if (!select || !modalEl || !listEl) return;
    if (titleEl) titleEl.textContent = title || '';
    renderAppPickerList(select, listEl);
    showModal(modalEl);
    if (!select.options.length) {
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (select.options.length || tries > 24) {
          clearInterval(timer);
          renderAppPickerList(select, listEl);
        }
      }, 200);
    }
  }

  function renderAppSelectChips(selectId, chipsId) {
    var select = document.getElementById(selectId);
    var wrap = document.getElementById(chipsId);
    if (!select || !wrap) return;
    var current = select.value;
    wrap.innerHTML = '';
    Array.prototype.forEach.call(select.options, function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-secondary pc-angle-btn pc-app-chip' + (opt.value === current ? ' active' : '');
      btn.textContent = opt.textContent || opt.value;
      btn.setAttribute('data-value', opt.value);
      btn.addEventListener('click', function () {
        if (select.value === opt.value) return;
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        wrap.querySelectorAll('.pc-app-chip').forEach(function (chip) {
          chip.classList.toggle('active', chip.getAttribute('data-value') === opt.value);
        });
      });
      wrap.appendChild(btn);
    });
  }

  function setupAppFormPickers() {
    renderAppSelectChips('pcRatioSelect', 'pcRatioChips');
    renderAppSelectChips('pcMpSelect', 'pcMpChips');
    syncAppPickerLabels();
    var themeBtn = document.getElementById('pcThemePickerBtn');
    var sceneBtn = document.getElementById('pcScenePickerBtn');
    if (themeBtn && themeBtn.getAttribute('data-pc-bound') !== '1') {
      themeBtn.setAttribute('data-pc-bound', '1');
      themeBtn.addEventListener('click', function () {
        openAppPicker('pcThemeSelect', t('promoCamera.theme', '主題'));
      });
    }
    if (sceneBtn && sceneBtn.getAttribute('data-pc-bound') !== '1') {
      sceneBtn.setAttribute('data-pc-bound', '1');
      sceneBtn.addEventListener('click', function () {
        openAppPicker('pcSceneSelect', t('promoCamera.sceneOptional', '場景（選填）'));
      });
    }
  }

  function observeThemeSceneSelects() {
    ['pcThemeSelect', 'pcSceneSelect'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || typeof MutationObserver === 'undefined') return;
      new MutationObserver(function () {
        syncAppPickerLabels();
        updateComposeSummary();
      }).observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  function setComposeExpanded(expanded) {
    var body = document.getElementById('pcComposeBody');
    var toggle = document.getElementById('pcComposeToggle');
    if (!body || !toggle) return;
    body.classList.toggle('is-collapsed', !expanded);
    toggle.classList.toggle('is-open', expanded);
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    var panel = getChatPanel();
    if (panel) panel.classList.toggle('pc-compose-collapsed', !expanded);
  }

  function hookPreserveSubjectsSummary() {
    var sel = document.getElementById('pcPreserveSubjects');
    if (!sel || sel.getAttribute('data-pc-app-summary-bound') === '1') return;
    sel.setAttribute('data-pc-app-summary-bound', '1');
    sel.addEventListener('change', updateComposeSummary);
  }

  function setupComposeCollapse() {
    var toggle = document.getElementById('pcComposeToggle');
    var body = document.getElementById('pcComposeBody');
    if (!toggle || !body || toggle.getAttribute('data-pc-bound') === '1') return;
    toggle.setAttribute('data-pc-bound', '1');
    toggle.addEventListener('click', function () {
      setComposeExpanded(body.classList.contains('is-collapsed'));
    });
    setComposeExpanded(false);
    updateComposeSummary();
  }

  function setupGenerateDock() {
    if (document.getElementById('pcGenerateDock')) return;
    var btn = document.getElementById('pcGenerateBtn');
    var pts = document.getElementById('pcPointsDisplay');
    if (!btn || !pts) return;
    var inlineRow = btn.closest('.d-flex') || btn.closest('.pc-compose-generate-fallback');
    var dock = document.createElement('div');
    dock.id = 'pcGenerateDock';
    dock.className = 'pc-generate-dock';
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-label', t('promoCamera.generateDockLabel', '生成'));
    var meta = document.createElement('div');
    meta.className = 'pc-generate-dock-meta';
    meta.appendChild(pts);
    var action = document.createElement('div');
    action.className = 'pc-generate-dock-action';
    btn.classList.add('pc-generate-dock-btn');
    action.appendChild(btn);
    dock.appendChild(meta);
    dock.appendChild(action);
    document.body.appendChild(dock);
    document.body.classList.add('pc-has-generate-dock');
    if (inlineRow && inlineRow.parentNode) inlineRow.parentNode.removeChild(inlineRow);
  }

  function setCreditsModalState(state) {
    showEl(document.getElementById('pcCreditsLoading'), state === 'loading');
    showEl(document.getElementById('pcCreditsGuest'), state === 'guest');
    showEl(document.getElementById('pcCreditsPanel'), state === 'ready');
    var errEl = document.getElementById('pcCreditsError');
    if (!errEl) return;
    if (state === 'error') errEl.classList.remove('d-none');
    else {
      errEl.classList.add('d-none');
      errEl.textContent = '';
    }
  }

  function updateAppCreditsBadge(balance) {
    var badge = document.getElementById('pcAppCreditsBadge');
    if (!badge) return;
    if (balance == null || balance === '') {
      badge.classList.add('d-none');
      badge.textContent = '';
      return;
    }
    badge.textContent = String(balance);
    badge.classList.remove('d-none');
  }

  function openAppCreditsModal() {
    var modalEl = document.getElementById('pcCreditsModal');
    if (!modalEl || !Api.fetchMeCredits) return;
    setCreditsModalState('loading');
    showModal(modalEl);
    Api.fetchMeCredits().then(function (res) {
      if (res.status === 401 || res.status === 403) {
        setCreditsModalState('guest');
        updateAppCreditsBadge(null);
        return;
      }
      if (!res.ok || !res.data || res.data.error) {
        setCreditsModalState('error');
        var errEl = document.getElementById('pcCreditsError');
        if (errEl) errEl.textContent = (res.data && res.data.error) ? res.data.error : t('promoCamera.appCreditsLoadError', '無法載入點數，請稍後再試。');
        return;
      }
      var bal = document.getElementById('pcCreditsBalance');
      var earned = document.getElementById('pcCreditsEarned');
      var spent = document.getElementById('pcCreditsSpent');
      if (bal) bal.textContent = String(res.data.balance != null ? res.data.balance : 0);
      if (earned) earned.textContent = String(res.data.total_earned != null ? res.data.total_earned : 0);
      if (spent) spent.textContent = String(res.data.total_spent != null ? res.data.total_spent : 0);
      setCreditsModalState('ready');
      updateAppCreditsBadge(res.data.balance);
    }).catch(function () {
      setCreditsModalState('error');
      var errEl = document.getElementById('pcCreditsError');
      if (errEl) errEl.textContent = t('promoCamera.appCreditsLoadError', '無法載入點數，請稍後再試。');
    });
  }

  function refreshAppCreditsBadge() {
    if (!Api.fetchMeCredits) return;
    Api.fetchMeCredits().then(function (res) {
      if (res.ok && res.data && res.data.balance != null) updateAppCreditsBadge(res.data.balance);
    }).catch(function () { /* ignore */ });
  }

  function setupAppLangSwitch() {
    var wrap = document.querySelector('.pc-app-lang-switch');
    if (!wrap || wrap.getAttribute('data-pc-bound') === '1') return;
    wrap.setAttribute('data-pc-bound', '1');
    var cur = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh-TW';
    wrap.querySelectorAll('.pc-app-lang-link').forEach(function (link) {
      var lang = link.getAttribute('data-lang');
      link.classList.toggle('is-active', lang === cur);
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (lang && window.i18n && window.i18n.setLang) window.i18n.setLang(lang);
      });
    });
  }

  function syncAppLoginLinks() {
    var link = document.getElementById('pcCreditsLoginLink');
    if (!link) return;
    var returnUrl = '/promo-camera-app';
    if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') returnUrl += '?lang=en';
    link.href = '/login.html?returnUrl=' + encodeURIComponent(returnUrl);
  }

  function onI18nApplied() {
    setupAppLangSwitch();
    syncAppLoginLinks();
    syncAppPickerLabels();
    updateComposeSummary();
  }

  function onPresetApplied() {
    syncAppPickerLabels();
    updateComposeSummary();
    renderAppSelectChips('pcRatioSelect', 'pcRatioChips');
    renderAppSelectChips('pcMpSelect', 'pcMpChips');
  }

  function setupAppAssetLibrary() {
    var btn = document.getElementById('pcAppLibraryBtn');
    var modalEl = document.getElementById('pcAssetLibraryModal');
    if (!btn || !modalEl || btn.getAttribute('data-pc-bound') === '1') return;
    btn.setAttribute('data-pc-bound', '1');
    var libraryMount = null;
    btn.addEventListener('click', function () {
      showModal(modalEl);
      if (!window.MatchdoDigitalAssetPicker || typeof window.MatchdoDigitalAssetPicker.mount !== 'function') {
        var emptyEl = document.getElementById('pcLibraryEmpty');
        var loadingEl = document.getElementById('pcLibraryLoading');
        if (loadingEl) loadingEl.classList.add('d-none');
        if (emptyEl) {
          emptyEl.textContent = t('promoCamera.assetPickerFailed', '載入失敗，請稍後再試。');
          emptyEl.classList.remove('d-none');
        }
        return;
      }
      if (!libraryMount) {
        libraryMount = window.MatchdoDigitalAssetPicker.mount({
          tabsEl: document.getElementById('pcLibraryPickerTabs'),
          listEl: document.getElementById('pcLibraryList'),
          emptyEl: document.getElementById('pcLibraryEmpty'),
          loadingEl: document.getElementById('pcLibraryLoading'),
          initialTab: 'promo',
          mode: 'browse'
        });
      } else if (typeof libraryMount.reload === 'function') {
        libraryMount.reload('promo');
      }
    });
  }

  function setupAppCreditsPanel() {
    var btn = document.getElementById('pcAppCreditsBtn');
    var topUpBtn = document.getElementById('pcCreditsTopUpBtn');
    if (btn && btn.getAttribute('data-pc-bound') !== '1') {
      btn.setAttribute('data-pc-bound', '1');
      btn.addEventListener('click', openAppCreditsModal);
    }
    if (topUpBtn && topUpBtn.getAttribute('data-pc-bound') !== '1') {
      topUpBtn.setAttribute('data-pc-bound', '1');
      topUpBtn.addEventListener('click', function () {
        var returnUrl = '/promo-camera-app';
        if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
          returnUrl += '?lang=en';
        }
        window.open('/credits.html?returnUrl=' + encodeURIComponent(returnUrl), '_blank', 'noopener,noreferrer');
      });
    }
    refreshAppCreditsBadge();
  }

  function decorateAngleChips() {
    document.querySelectorAll('#pcAngleBtns .pc-angle-btn').forEach(function (btn) {
      btn.classList.add('pc-app-chip');
    });
  }

  function hookSelectSummary() {
    ['pcThemeSelect', 'pcSceneSelect', 'pcRatioSelect', 'pcMpSelect'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.getAttribute('data-pc-app-bound') === '1') return;
      el.setAttribute('data-pc-app-bound', '1');
      el.addEventListener('change', function () {
        syncAppPickerLabels();
        updateComposeSummary();
        if (id === 'pcRatioSelect' || id === 'pcMpSelect') {
          renderAppSelectChips(id, id === 'pcRatioSelect' ? 'pcRatioChips' : 'pcMpChips');
        }
      });
    });
  }

  function hookGenerateCreditsRefresh() {
    var btn = document.getElementById('pcGenerateBtn');
    if (!btn || btn.getAttribute('data-pc-app-credits-bound') === '1') return;
    btn.setAttribute('data-pc-app-credits-bound', '1');
    btn.addEventListener('click', function () {
      setTimeout(refreshAppCreditsBadge, 1500);
    });
  }

  function hookThumbSummary() {
    var wrap = document.getElementById('pcSelectedThumbs');
    if (!wrap || typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function () {
      updateComposeSummary();
    });
    obs.observe(wrap, { childList: true, subtree: true });
  }

  function waitForThemeOptions(cb) {
    var themeEl = document.getElementById('pcThemeSelect');
    if (!themeEl) return;
    if (themeEl.options.length > 0) {
      cb();
      return;
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (themeEl.options.length > 0 || tries > 40) {
        clearInterval(timer);
        cb();
      }
    }, 250);
  }

  function bootAppShell() {
    setupAppLangSwitch();
    syncAppLoginLinks();
    setupGenerateDock();
    setupComposeCollapse();
    hookPreserveSubjectsSummary();
    setupAppCreditsPanel();
    setupAppAssetLibrary();
    setupAppFormPickers();
    observeThemeSceneSelects();
    hookSelectSummary();
    hookGenerateCreditsRefresh();
    hookThumbSummary();
    observeResultArea();
    decorateAngleChips();
    waitForThemeOptions(function () {
      syncAppPickerLabels();
      setupAppFormPickers();
      updateComposeSummary();
      decorateAngleChips();
    });
    var angleWrap = document.getElementById('pcAngleBtns');
    if (angleWrap && typeof MutationObserver !== 'undefined') {
      new MutationObserver(decorateAngleChips).observe(angleWrap, { childList: true, subtree: true });
    }
  }

  document.addEventListener('matchdo-i18n-applied', onI18nApplied);
  document.addEventListener('matchdo-pc-preset-applied', onPresetApplied);
  document.addEventListener('matchdo-pc-options-ready', function () {
    hookPreserveSubjectsSummary();
    updateComposeSummary();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAppShell);
  } else {
    bootAppShell();
  }
})();
