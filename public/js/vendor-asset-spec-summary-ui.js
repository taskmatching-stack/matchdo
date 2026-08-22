/**
 * 廠商／官方／供應商上傳＋編輯 — 規格卡右側狀態（僅 UI，不改上傳／API／操作）
 */
(function () {
  'use strict';

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback != null ? fallback : key;
  }

  function truncate(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, Math.max(1, n - 1)) + '…';
  }

  function joinParts(parts) {
    return parts.filter(Boolean).join(' · ') || '';
  }

  function selectText(sel) {
    if (!sel || sel.tagName !== 'SELECT') return '';
    var opt = sel.options[sel.selectedIndex];
    if (!opt) return '';
    var txt = String(opt.textContent || '').trim();
    if (!txt || txt === '—' || txt.indexOf('請選擇') >= 0 || txt.indexOf('未指定') >= 0) return '';
    return txt;
  }

  function setVal(root, key, text, pending) {
    root.querySelectorAll('.va-spec-value[data-va-spec="' + key + '"]').forEach(function (el) {
      el.textContent = text || '—';
      var kind = pending === 'optional-empty' ? 'optional-empty' : (pending ? 'pending' : '');
      el.classList.toggle('va-spec-value--pending', kind === 'pending');
      el.classList.toggle('va-spec-value--optional-empty', kind === 'optional-empty');
    });
  }

  function countChecked(root, sel) {
    if (!root) return 0;
    return root.querySelectorAll(sel).length;
  }

  function selectedCapabilityLabels(root) {
    if (!root) return [];
    var labels = [];
    root.querySelectorAll('.add-capability-row .cap-leaf').forEach(function (sel) {
      var txt = selectText(sel);
      if (txt) labels.push(truncate(txt, 10));
    });
    root.querySelectorAll('.add-capability-custom-input').forEach(function (inp) {
      var v = String(inp.value || '').trim();
      if (v) labels.push(truncate(v, 10));
    });
    return labels;
  }

  function syncHideEmpty(root) {
    root.querySelectorAll('.va-spec-block[data-va-hide-empty]').forEach(function (card) {
      var body = card.querySelector('.va-spec-body');
      if (!body) return;
      var any = false;
      Array.prototype.forEach.call(body.children, function (ch) {
        if (!ch.classList.contains('d-none')) any = true;
      });
      card.classList.toggle('d-none', !any);
    });
  }

  function refreshAddForm(form) {
    var n = form.querySelectorAll('.add-pending-images .pending-image-card').length;
    var ptsEl = form.querySelector('.add-points-estimate-val');
    var pts = ptsEl ? String(ptsEl.textContent || '').trim() : '';
    var imgTxt = n
      ? t('baseModels.specImagesSelected', '已選 {n} 張').replace('{n}', String(n))
      : t('baseModels.specImagesNone', '未選');
    if (n && pts) imgTxt += ' · ' + t('baseModels.specPointsEst', '預估 {p} 點').replace('{p}', pts);
    setVal(form, 'images', imgTxt, n ? false : true);

    var title = String((form.querySelector('.add-title') || {}).value || '').trim();
    var desc = String((form.querySelector('.add-description') || {}).value || '').trim();
    var titleRequired = !!(form.querySelector('.add-title[required]'));
    var nameParts = [];
    if (title) nameParts.push(truncate(title, 22));
    if (desc) nameParts.push(t('baseModels.specDescFilled', '說明已填'));
    else if (title) nameParts.push(t('baseModels.specDescAuto', '說明將自動產生'));
    setVal(form, 'name', joinParts(nameParts) || t('baseModels.specNameEmpty', '未填'), title ? false : (titleRequired ? true : 'optional-empty'));

    var cat = selectText(form.querySelector('.add-category'));
    var subEl = form.querySelector('.add-subcategory');
    var sub = subEl ? selectText(subEl) : '';
    var moqEl = form.querySelector('.add-min-order-qty');
    var moq = moqEl ? String(moqEl.value || '').trim() : '';
    var moqRequired = !!(moqEl && moqEl.required);
    var needSub = !!(subEl && form.getAttribute('data-kind') === 'prototype');
    var prod = selectText(form.querySelector('.add-production-type'));
    var myCat = form.querySelectorAll('[class*="add-catalog-groups"] input:checked, [class*="add-catalog-groups"] .form-check-input:checked').length;
    var catParts = [];
    catParts.push(cat || t('baseModels.specCategoryNone', '未選'));
    if (needSub && cat) catParts.push(sub || t('baseModels.specSubcategoryNone', '未選子分類'));
    if (moqRequired) catParts.push(moq ? ('MOQ ' + moq) : t('baseModels.specMoqEmpty', '未填最小訂購量'));
    else if (moq) catParts.push('MOQ ' + moq);
    if (prod) catParts.push(prod);
    if (myCat) catParts.push(t('baseModels.specMyCatalogN', '我的分類 {n}').replace('{n}', String(myCat)));
    var catPending = !cat || (needSub && !sub) || (moqRequired && !moq);
    setVal(form, 'category', joinParts(catParts), catPending);

    var craftN = form.querySelectorAll('.add-customization-levels .customization-level-btn.active').length;
    var capLabels = selectedCapabilityLabels(form);
    var hasLevels = !!form.querySelector('.add-customization-levels');
    var craftParts = [];
    if (hasLevels) {
      craftParts.push(craftN
        ? t('baseModels.specCraftLevels', '訂製 {n} 項').replace('{n}', String(craftN))
        : t('baseModels.specCraftLevelsNone', '未選訂製程度'));
    }
    if (capLabels.length) craftParts.push(capLabels.join('、'));
    var craftPending = !!(hasLevels && !craftN);
    setVal(form, 'craft', joinParts(craftParts) || t('baseModels.specOptionalSkip', '未選（可略過）'), craftPending ? true : (craftParts.length ? false : 'optional-empty'));

    var linkN = form.querySelectorAll('.add-prototype-links-list input:checked, .add-linked-prototypes-list input:checked').length;
    setVal(
      form,
      'links',
      linkN ? t('baseModels.specLinksN', '已勾 {n} 項').replace('{n}', String(linkN)) : t('baseModels.specLinksNone', '未選（可略過）'),
      linkN ? false : 'optional-empty'
    );

    var specBits = [];
    ['add-part-type', 'add-finish', 'add-material', 'add-dimensions', 'add-material-type', 'add-composition', 'add-width-cm', 'add-material-surface-type'].forEach(function (cls) {
      var el = form.querySelector('.' + cls);
      var v = el ? String(el.value || '').trim() : '';
      if (v) specBits.push(truncate(v, 12));
    });
    if (form.querySelector('[data-va-spec="spec"]')) {
      setVal(form, 'spec', joinParts(specBits) || t('baseModels.specOptionalSkip', '未選（可略過）'), specBits.length ? false : 'optional-empty');
    }
  }

  function refreshEdit(form) {
    var protoWrap = document.getElementById('edit-images-prototype-wrap');
    var matWrap = document.getElementById('edit-images-material-wrap');
    var galWrap = document.getElementById('edit-images-gallery-wrap');
    var n = 0;
    if (protoWrap && !protoWrap.classList.contains('d-none')) {
      n = protoWrap.querySelectorAll('#edit-gallery-grid .pending-image-card, #edit-gallery-grid img.pending-main-thumb, #edit-gallery-grid .pending-card-media img').length;
      if (!n) n = protoWrap.querySelectorAll('#edit-gallery-grid img').length;
    } else if (galWrap && !galWrap.classList.contains('d-none')) {
      n = galWrap.querySelectorAll('#edit-gallery-grid .pending-image-card').length;
      if (!n) n = galWrap.querySelectorAll('#edit-gallery-grid img').length;
    } else if (matWrap && !matWrap.classList.contains('d-none')) {
      var cur = document.getElementById('edit-current-image-wrap');
      if (cur && !cur.classList.contains('d-none')) n = 1;
    }
    var pendingN = form.querySelectorAll('#edit-gallery-pending .pending-image-card, .add-pending-images .pending-image-card').length;
    var imgTxt = n
      ? t('baseModels.specImagesSelected', '已選 {n} 張').replace('{n}', String(n))
      : t('baseModels.specImagesNone', '未選');
    if (pendingN) imgTxt += ' · ' + t('baseModels.specPendingN', '待傳 {n}').replace('{n}', String(pendingN));
    setVal(form, 'images', imgTxt, !n);

    var title = String((document.getElementById('edit-title') || {}).value || '').trim();
    var desc = String((document.getElementById('edit-description') || {}).value || '').trim();
    var surface = String((document.getElementById('edit-material-surface-type') || {}).value || '').trim();
    var nameParts = [];
    if (title) nameParts.push(truncate(title, 22));
    if (desc) nameParts.push(t('baseModels.specDescFilled', '說明已填'));
    if (surface) nameParts.push(truncate(surface, 14));
    setVal(form, 'name', joinParts(nameParts) || t('baseModels.specNameEmpty', '未填'), title ? false : 'optional-empty');

    var cat = selectText(document.getElementById('edit-category'));
    var subWrap = document.getElementById('edit-subcategory-wrap');
    var subEl = document.getElementById('edit-subcategory');
    var needSub = !!(subWrap && !subWrap.classList.contains('d-none') && subEl);
    var sub = needSub ? selectText(subEl) : '';
    var moq = String((document.getElementById('edit-min-order-qty') || {}).value || '').trim();
    var myCat = countChecked(document.getElementById('edit-catalog-groups'), 'input:checked');
    var catParts = [];
    catParts.push(cat || t('baseModels.specCategoryNone', '未選'));
    if (needSub && cat) catParts.push(sub || t('baseModels.specSubcategoryNone', '未選子分類'));
    if (myCat) catParts.push(t('baseModels.specMyCatalogN', '我的分類 {n}').replace('{n}', String(myCat)));
    setVal(form, 'category', joinParts(catParts), !cat || (needSub && !sub));

    var tax = document.getElementById('edit-taxonomy-wrap');
    var levels = document.getElementById('edit-customization-levels');
    var craftN = levels ? levels.querySelectorAll('.customization-level-btn.active').length : 0;
    var capLabels = selectedCapabilityLabels(tax || form);
    var craftParts = [];
    if (tax && !tax.classList.contains('d-none')) {
      var prod = selectText(document.getElementById('edit-production-type'));
      if (prod) craftParts.push(prod);
      if (capLabels.length) craftParts.push(capLabels.join('、'));
    }
    setVal(form, 'craft', joinParts(craftParts) || t('baseModels.specOptionalSkip', '未選（可略過）'), craftParts.length ? false : 'optional-empty');
    if (form.querySelector('[data-va-spec="meta"]')) {
      var metaParts = [];
      metaParts.push(moq ? ('MOQ ' + moq) : t('baseModels.specMoqEmpty', '未填最小訂購量'));
      metaParts.push(craftN
        ? t('baseModels.specCraftLevels', '訂製 {n} 項').replace('{n}', String(craftN))
        : t('baseModels.specCraftLevelsNone', '未選訂製程度'));
      setVal(form, 'meta', joinParts(metaParts), !moq || !craftN);
    }

    var linkN = countChecked(form, '#edit-prototype-links-list input:checked, #edit-linked-prototypes-list input:checked');
    setVal(
      form,
      'links',
      linkN ? t('baseModels.specLinksN', '已勾 {n} 項').replace('{n}', String(linkN)) : t('baseModels.specLinksNone', '未選（可略過）'),
      linkN ? false : 'optional-empty'
    );

    var tagN = countChecked(form, '#edit-tags-list .badge, #edit-tags-list [data-tag]');
    if (!tagN) tagN = (document.getElementById('edit-tags-list') || { children: [] }).children.length;
    setVal(form, 'tags', tagN ? t('baseModels.specTagsN', '{n} 個標籤').replace('{n}', String(tagN)) : t('baseModels.specTagsNone', '無標籤'), tagN ? false : 'optional-empty');

    var shareFields = document.getElementById('edit-share-embed-fields');
    var shareOn = shareFields && !shareFields.classList.contains('d-none');
    setVal(form, 'share', shareOn ? t('baseModels.specShareReady', '可嵌入') : t('baseModels.specShareWait', '載入中'), shareOn ? false : 'optional-empty');

    var specBits = [];
    ['edit-part-type', 'edit-finish-part', 'edit-part-material', 'edit-dimensions', 'edit-material-type', 'edit-composition', 'edit-finish-material', 'edit-width-cm'].forEach(function (id) {
      var el = document.getElementById(id);
      var v = el ? String(el.value || '').trim() : '';
      if (v) specBits.push(truncate(v, 12));
    });
    if (form.querySelector('[data-va-spec="spec"]')) {
      setVal(form, 'spec', joinParts(specBits) || t('baseModels.specOptionalSkip', '未選（可略過）'), specBits.length ? false : 'optional-empty');
    }

    syncHideEmpty(form);
  }

  function refresh() {
    document.querySelectorAll('form.add-form.va-spec-root').forEach(refreshAddForm);
    var edit = document.getElementById('edit-form');
    if (edit && edit.classList.contains('va-spec-root')) refreshEdit(edit);
  }

  function inSpecRoot(el) {
    return !!(el && el.closest && el.closest('.va-spec-root'));
  }

  function bind() {
    document.addEventListener('input', function (e) { if (inSpecRoot(e.target)) refresh(); });
    document.addEventListener('change', function (e) { if (inSpecRoot(e.target)) refresh(); });
    document.addEventListener('click', function (e) { if (inSpecRoot(e.target)) setTimeout(refresh, 0); });
    document.addEventListener('invalid', function (e) {
      var card = e.target && e.target.closest && e.target.closest('.va-spec-block');
      if (card) card.open = true;
    }, true);
    if (typeof MutationObserver !== 'undefined') {
      document.querySelectorAll('.va-spec-root').forEach(function (el) {
        try {
          new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
              var t = muts[i].target;
              if (t && t.classList && t.classList.contains('va-spec-value')) continue;
              refresh();
              return;
            }
          }).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        } catch (err) {}
      });
    }
    document.querySelectorAll('#edit-modal').forEach(function (modal) {
      modal.addEventListener('shown.bs.modal', refresh);
    });
    refresh();
    setTimeout(refresh, 400);
    setTimeout(refresh, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
