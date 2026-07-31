/**
 * 攝影模擬 — 帳號攝影參數預設（API 同步，Web + App 共用）
 */
(function () {
  'use strict';

  var MAX_PRESETS = 20;

  var St = window.PromoCameraState;
  var Api = window.PromoCameraApi;
  if (!St || !Api) return;

  var cachedPresets = [];
  var loggedIn = null;
  var listLoading = false;

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback != null ? fallback : key;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function loginReturnUrl() {
    var path = window.location.pathname || '/promo-camera';
    if (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') {
      path += (path.indexOf('?') >= 0 ? '&' : '?') + 'lang=en';
    }
    return path;
  }

  function syncPromptFromDom() {
    var el = document.getElementById('pcPromptInput');
    if (el) St.get().userPrompt = (el.value || '').trim();
  }

  function formatSavedAt(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function presetSummary(snapshot) {
    if (!snapshot) return '';
    var parts = [];
    var ratio = snapshot.aspectRatio || '';
    var mp = snapshot.megapixels ? snapshot.megapixels + ' MP' : '';
    if (ratio && mp) parts.push(ratio + ' · ' + mp);
    else if (ratio) parts.push(ratio);
    var mode = snapshot.lookMode === 'film'
      ? t('promoCamera.cat.film_simulation', '底片模擬')
      : t('promoCamera.cat.camera_brand', '品牌色彩');
    parts.push(mode);
    return parts.join(' · ');
  }

  function refreshDomFromState() {
    if (window.PromoCameraUi && typeof window.PromoCameraUi.refreshFromState === 'function') {
      window.PromoCameraUi.refreshFromState();
      return;
    }
    document.dispatchEvent(new CustomEvent('matchdo-pc-preset-applied'));
  }

  function fetchPresetList(force) {
    if (listLoading && !force) return Promise.resolve(cachedPresets);
    listLoading = true;
    return Api.listPresets().then(function (res) {
      listLoading = false;
      if (res.status === 401) {
        loggedIn = false;
        cachedPresets = [];
        return cachedPresets;
      }
      if (!res.ok) {
        if (res.data && res.data.code === 'MIGRATION_REQUIRED') {
          throw new Error('migration');
        }
        throw new Error((res.data && res.data.error) || 'load_failed');
      }
      loggedIn = true;
      cachedPresets = (res.data && res.data.presets) ? res.data.presets : [];
      return cachedPresets;
    }).catch(function (err) {
      listLoading = false;
      throw err;
    });
  }

  function applyPresetById(id) {
    var hit = cachedPresets.find(function (p) { return p.id === id; });
    if (!hit || !hit.snapshot) return Promise.resolve(false);
    if (!St.get().options) return Promise.resolve(false);
    if (!St.applyPreset(hit.snapshot)) return Promise.resolve(false);
    refreshDomFromState();
    return Promise.resolve(true);
  }

  function saveCurrentPreset(name) {
    syncPromptFromDom();
    var label = String(name || '').trim();
    if (!label) return Promise.resolve({ ok: false, error: 'name_required' });
    if (!St.get().options) return Promise.resolve({ ok: false, error: 'options_not_ready' });
    var snapshot = St.toPresetSnapshot(label);
    return Api.savePreset(label, snapshot).then(function (res) {
      if (res.status === 401) return { ok: false, error: 'login_required' };
      if (!res.ok) {
        if (res.data && res.data.code === 'MAX_REACHED') return { ok: false, error: 'max_reached' };
        if (res.data && res.data.code === 'MIGRATION_REQUIRED') return { ok: false, error: 'migration' };
        return { ok: false, error: 'save_failed', message: (res.data && res.data.error) || '' };
      }
      loggedIn = true;
      if (res.data && res.data.preset) {
        cachedPresets = [res.data.preset].concat(cachedPresets.filter(function (p) { return p.id !== res.data.preset.id; }));
      }
      return { ok: true, preset: res.data && res.data.preset };
    });
  }

  function deletePresetById(id) {
    return Api.deletePreset(id).then(function (res) {
      if (res.status === 401) return { ok: false, error: 'login_required' };
      if (!res.ok) return { ok: false, error: 'delete_failed' };
      cachedPresets = cachedPresets.filter(function (p) { return p.id !== id; });
      return { ok: true };
    });
  }

  var modalEl = null;
  var modalInstance = null;
  var statusTimer = null;

  function getModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.id = 'pcPresetModal';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-labelledby', 'pcPresetModalTitle');
    modalEl.innerHTML =
      '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable pc-preset-dialog">' +
        '<div class="modal-content pc-preset-modal">' +
          '<div class="modal-header py-2">' +
            '<h6 class="modal-title mb-0" id="pcPresetModalTitle" data-i18n="promoCamera.presetModalTitle">我的攝影參數</h6>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="home.close" aria-label="關閉"></button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div id="pcPresetGuest" class="d-none">' +
              '<p class="small mb-2" data-i18n="promoCamera.presetLoginHint">登入後可將攝影參數存到帳號，換裝置也能快速帶入。</p>' +
              '<a href="/login.html" class="btn btn-primary btn-sm" id="pcPresetLoginLink" data-i18n="credits.loginRequiredLink">登入</a>' +
            '</div>' +
            '<div id="pcPresetAuthed">' +
              '<div class="pc-preset-save-row">' +
                '<label class="form-label small mb-1" for="pcPresetNameInput" data-i18n="promoCamera.presetNameLabel">預設名稱</label>' +
                '<div class="input-group input-group-sm">' +
                  '<input type="text" class="form-control" id="pcPresetNameInput" maxlength="40" data-i18n-placeholder="promoCamera.presetNamePlaceholder" placeholder="例：白底商品・標準">' +
                  '<button type="button" class="btn btn-primary" id="pcPresetSaveConfirmBtn">' +
                    '<i class="bi bi-bookmark-plus"></i> <span data-i18n="promoCamera.presetSaveBtn">儲存目前參數</span>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<p class="small text-muted mb-2 pc-preset-hint" data-i18n="promoCamera.presetHintAccount">儲存至您的 MatchDO 帳號（主題、場景、輸出尺寸、相機與描述；不含產品圖）。</p>' +
            '</div>' +
            '<div id="pcPresetStatus" class="small pc-preset-status d-none" role="status"></div>' +
            '<hr class="my-2" />' +
            '<div class="pc-preset-list-head small fw-semibold mb-2" data-i18n="promoCamera.presetListTitle">已儲存</div>' +
            '<div id="pcPresetLoading" class="text-muted small d-none" data-i18n="home.loading">載入中…</div>' +
            '<div id="pcPresetList" class="pc-preset-list"></div>' +
            '<p id="pcPresetEmpty" class="text-muted small mb-0 d-none" data-i18n="promoCamera.presetEmpty">尚無儲存的攝影參數。</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function showModal() {
    var el = getModal();
    if (typeof bootstrap === 'undefined') return;
    if (!modalInstance) modalInstance = new bootstrap.Modal(el);
    modalInstance.show();
  }

  function setStatus(msg, kind) {
    var el = document.getElementById('pcPresetStatus');
    if (!el) return;
    if (statusTimer) clearTimeout(statusTimer);
    if (!msg) {
      el.classList.add('d-none');
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.className = 'small pc-preset-status' + (kind === 'error' ? ' text-danger' : ' text-success');
    el.classList.remove('d-none');
    statusTimer = setTimeout(function () {
      el.classList.add('d-none');
    }, 2800);
  }

  function setGuestMode(isGuest) {
    var guest = document.getElementById('pcPresetGuest');
    var authed = document.getElementById('pcPresetAuthed');
    if (guest) guest.classList.toggle('d-none', !isGuest);
    if (authed) authed.classList.toggle('d-none', isGuest);
    var loginLink = document.getElementById('pcPresetLoginLink');
    if (loginLink) {
      loginLink.href = '/login.html?returnUrl=' + encodeURIComponent(loginReturnUrl());
    }
  }

  function renderPresetList() {
    var listEl = document.getElementById('pcPresetList');
    var emptyEl = document.getElementById('pcPresetEmpty');
    var loadingEl = document.getElementById('pcPresetLoading');
    if (!listEl) return;
    if (loadingEl) loadingEl.classList.add('d-none');
    var list = cachedPresets;
    if (emptyEl) emptyEl.classList.toggle('d-none', list.length > 0 || loggedIn === false);
    if (!list.length) {
      listEl.innerHTML = '';
      if (emptyEl && loggedIn === false) {
        emptyEl.textContent = t('promoCamera.presetGuestEmpty', '登入後即可儲存與帶入您的攝影參數。');
        emptyEl.classList.remove('d-none');
      } else if (emptyEl) {
        emptyEl.textContent = t('promoCamera.presetEmpty', '尚無儲存的攝影參數。');
      }
      return;
    }
    listEl.innerHTML = list.map(function (p) {
      var when = formatSavedAt(p.savedAt);
      var summary = presetSummary(p.snapshot);
      return '<div class="pc-preset-item" data-id="' + esc(p.id) + '">' +
        '<div class="pc-preset-item-main">' +
          '<div class="pc-preset-item-name">' + esc(p.name || summary) + '</div>' +
          '<div class="pc-preset-item-meta text-muted small">' + esc(summary) + (when ? ' · ' + esc(when) : '') + '</div>' +
        '</div>' +
        '<div class="pc-preset-item-actions">' +
          '<button type="button" class="btn btn-sm btn-primary pc-preset-apply-btn" data-id="' + esc(p.id) + '">' +
            esc(t('promoCamera.presetApplyBtn', '帶入')) +
          '</button>' +
          '<button type="button" class="btn btn-sm btn-outline-danger pc-preset-delete-btn" data-id="' + esc(p.id) + '" title="' + esc(t('promoCamera.presetDelete', '刪除')) + '">' +
            '<i class="bi bi-trash"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function bindModalEvents() {
    var el = getModal();
    if (el.getAttribute('data-pc-bound') === '1') return;
    el.setAttribute('data-pc-bound', '1');

    el.addEventListener('click', function (e) {
      var applyBtn = e.target.closest('.pc-preset-apply-btn');
      if (applyBtn) {
        applyPresetById(applyBtn.getAttribute('data-id')).then(function (ok) {
          if (ok) setStatus(t('promoCamera.presetApplied', '已帶入攝影參數'), 'ok');
          else setStatus(t('promoCamera.presetApplyFailed', '無法帶入，請確認選項已載入'), 'error');
        });
        return;
      }
      var delBtn = e.target.closest('.pc-preset-delete-btn');
      if (delBtn) {
        var delId = delBtn.getAttribute('data-id');
        if (!window.confirm(t('promoCamera.presetConfirmDelete', '確定刪除此預設？'))) return;
        deletePresetById(delId).then(function (res) {
          if (res.ok) {
            renderPresetList();
            setStatus(t('promoCamera.presetDeleted', '已刪除'), 'ok');
          } else {
            setStatus(t('promoCamera.presetDeleteFailed', '刪除失敗'), 'error');
          }
        });
      }
    });

    var saveBtn = document.getElementById('pcPresetSaveConfirmBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var nameInput = document.getElementById('pcPresetNameInput');
        var name = nameInput ? nameInput.value : '';
        saveCurrentPreset(name).then(function (res) {
          if (!res.ok) {
            if (res.error === 'name_required') {
              setStatus(t('promoCamera.presetNameRequired', '請輸入預設名稱'), 'error');
            } else if (res.error === 'login_required') {
              setGuestMode(true);
              setStatus(t('promoCamera.presetLoginHint', '請先登入'), 'error');
            } else if (res.error === 'max_reached') {
              setStatus(t('promoCamera.presetMaxReached', '已達上限（20 組），請先刪除舊預設'), 'error');
            } else if (res.error === 'migration') {
              setStatus(t('promoCamera.presetMigrationRequired', '後台資料表尚未建立，請聯絡管理員'), 'error');
            } else {
              setStatus(res.message || t('promoCamera.presetSaveFailed', '儲存失敗'), 'error');
            }
            return;
          }
          if (nameInput) nameInput.value = '';
          renderPresetList();
          setStatus(t('promoCamera.presetSaved', '已儲存至帳號'), 'ok');
        });
      });
    }

    el.addEventListener('shown.bs.modal', function () {
      var loadingEl = document.getElementById('pcPresetLoading');
      if (loadingEl) loadingEl.classList.remove('d-none');
      fetchPresetList(true).then(function () {
        setGuestMode(loggedIn === false);
        renderPresetList();
        if (window.i18n && window.i18n.applyPage) window.i18n.applyPage(el);
        var nameInput = document.getElementById('pcPresetNameInput');
        if (nameInput && loggedIn !== false) nameInput.focus();
      }).catch(function (err) {
        setGuestMode(false);
        if (loadingEl) loadingEl.classList.add('d-none');
        if (err && err.message === 'migration') {
          setStatus(t('promoCamera.presetMigrationRequired', '後台資料表尚未建立，請聯絡管理員'), 'error');
        } else {
          setStatus(t('promoCamera.presetLoadFailed', '無法載入預設列表'), 'error');
        }
        renderPresetList();
      });
    });
  }

  function setOpenButtonReady(ready) {
    var btn = document.getElementById('pcPresetOpenBtn');
    if (!btn) return;
    btn.disabled = !ready;
    btn.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }

  function openPresetModal() {
    if (!St.get().options) {
      window.alert(t('promoCamera.presetOptionsNotReady', '選項尚未載入，請稍候'));
      return;
    }
    getModal();
    bindModalEvents();
    showModal();
  }

  function bindOpenButton() {
    var btn = document.getElementById('pcPresetOpenBtn');
    if (!btn || btn.getAttribute('data-pc-bound') === '1') return;
    btn.setAttribute('data-pc-bound', '1');
    btn.addEventListener('click', openPresetModal);
  }

  function init() {
    bindOpenButton();
    setOpenButtonReady(!!(St.get().options));
    document.addEventListener('matchdo-pc-options-ready', function () {
      bindOpenButton();
      setOpenButtonReady(true);
    });
    document.addEventListener('matchdo-i18n-applied', function () {
      if (modalEl && window.i18n && window.i18n.applyPage) window.i18n.applyPage(modalEl);
    });
  }

  window.PromoCameraPresets = {
    list: function () { return fetchPresetList(true); },
    save: saveCurrentPreset,
    apply: applyPresetById,
    remove: deletePresetById,
    openModal: openPresetModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
