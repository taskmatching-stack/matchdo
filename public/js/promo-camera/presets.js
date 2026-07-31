/**
 * 攝影模擬 — 攝影參數預設（localStorage，Web + App 共用）
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'matchdo.promoCamera.presets.v1';
  var MAX_PRESETS = 20;

  var St = window.PromoCameraState;
  if (!St) return;

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

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function writeStore(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
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
    if (snapshot.name) parts.push(snapshot.name);
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

  function applyPresetById(id) {
    var list = readStore();
    var hit = list.find(function (p) { return p.id === id; });
    if (!hit || !hit.snapshot) return false;
    if (!St.get().options) return false;
    if (!St.applyPreset(hit.snapshot)) return false;
    refreshDomFromState();
    return true;
  }

  function saveCurrentPreset(name) {
    syncPromptFromDom();
    var label = String(name || '').trim();
    if (!label) return { ok: false, error: 'name_required' };
    if (!St.get().options) return { ok: false, error: 'options_not_ready' };
    var list = readStore();
    if (list.length >= MAX_PRESETS) return { ok: false, error: 'max_reached' };
    var snapshot = St.toPresetSnapshot(label);
    var entry = {
      id: 'pc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      name: label,
      savedAt: Date.now(),
      snapshot: snapshot
    };
    list.unshift(entry);
    if (!writeStore(list)) return { ok: false, error: 'storage_failed' };
    return { ok: true, preset: entry };
  }

  function deletePresetById(id) {
    var list = readStore().filter(function (p) { return p.id !== id; });
    writeStore(list);
    return true;
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
            '<h6 class="modal-title mb-0" id="pcPresetModalTitle" data-i18n="promoCamera.presetModalTitle">攝影參數預設</h6>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="home.close" aria-label="關閉"></button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div class="pc-preset-save-row">' +
              '<label class="form-label small mb-1" for="pcPresetNameInput" data-i18n="promoCamera.presetNameLabel">預設名稱</label>' +
              '<div class="input-group input-group-sm">' +
                '<input type="text" class="form-control" id="pcPresetNameInput" maxlength="40" data-i18n-placeholder="promoCamera.presetNamePlaceholder" placeholder="例：白底商品・標準">' +
                '<button type="button" class="btn btn-primary" id="pcPresetSaveConfirmBtn">' +
                  '<i class="bi bi-bookmark-plus"></i> <span data-i18n="promoCamera.presetSaveBtn">儲存目前參數</span>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<p class="small text-muted mb-2 pc-preset-hint" data-i18n="promoCamera.presetHint">儲存主題、場景、輸出尺寸、相機與描述；不含產品圖。</p>' +
            '<div id="pcPresetStatus" class="small pc-preset-status d-none" role="status"></div>' +
            '<hr class="my-2" />' +
            '<div class="pc-preset-list-head small fw-semibold mb-2" data-i18n="promoCamera.presetListTitle">已儲存</div>' +
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

  function renderPresetList() {
    var listEl = document.getElementById('pcPresetList');
    var emptyEl = document.getElementById('pcPresetEmpty');
    if (!listEl) return;
    var list = readStore();
    if (emptyEl) emptyEl.classList.toggle('d-none', list.length > 0);
    if (!list.length) {
      listEl.innerHTML = '';
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
        if (applyPresetById(applyBtn.getAttribute('data-id'))) {
          setStatus(t('promoCamera.presetApplied', '已帶入攝影參數'), 'ok');
        } else {
          setStatus(t('promoCamera.presetApplyFailed', '無法帶入，請確認選項已載入'), 'error');
        }
        return;
      }
      var delBtn = e.target.closest('.pc-preset-delete-btn');
      if (delBtn) {
        var delId = delBtn.getAttribute('data-id');
        var confirmMsg = t('promoCamera.presetConfirmDelete', '確定刪除此預設？');
        if (!window.confirm(confirmMsg)) return;
        deletePresetById(delId);
        renderPresetList();
        setStatus(t('promoCamera.presetDeleted', '已刪除'), 'ok');
      }
    });

    var saveBtn = document.getElementById('pcPresetSaveConfirmBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var nameInput = document.getElementById('pcPresetNameInput');
        var name = nameInput ? nameInput.value : '';
        var res = saveCurrentPreset(name);
        if (!res.ok) {
          if (res.error === 'name_required') {
            setStatus(t('promoCamera.presetNameRequired', '請輸入預設名稱'), 'error');
          } else if (res.error === 'max_reached') {
            setStatus(t('promoCamera.presetMaxReached', '已達上限（20 組），請先刪除舊預設'), 'error');
          } else if (res.error === 'options_not_ready') {
            setStatus(t('promoCamera.presetOptionsNotReady', '選項尚未載入，請稍候'), 'error');
          } else {
            setStatus(t('promoCamera.presetSaveFailed', '儲存失敗'), 'error');
          }
          return;
        }
        if (nameInput) nameInput.value = '';
        renderPresetList();
        setStatus(t('promoCamera.presetSaved', '已儲存攝影參數'), 'ok');
      });
    }

    el.addEventListener('shown.bs.modal', function () {
      renderPresetList();
      if (window.i18n && window.i18n.applyPage) window.i18n.applyPage(el);
      var nameInput = document.getElementById('pcPresetNameInput');
      if (nameInput) nameInput.focus();
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
    renderPresetList();
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
    list: readStore,
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
