/**
 * 設計稿 — 規格卡標題旁顯示目前設定值（僅 UI 摘要）
 */
(function () {
  function t(key, fallback) {
    var v = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : '';
    if (v && v !== key) return v;
    return fallback != null ? fallback : key;
  }

  function tf(key, fallback, map) {
    var s = t(key, fallback);
    if (map) {
      Object.keys(map).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(map[k]));
      });
    }
    return s;
  }

  function setVal(key, text, pending) {
    var el = document.querySelector('#custom-product .cp-spec-value[data-cp-spec="' + key + '"]');
    if (!el) return;
    el.textContent = text || '—';
    var kind = pending === 'optional-empty' ? 'optional-empty' : (pending ? 'pending' : '');
    el.classList.toggle('cp-spec-value--pending', kind === 'pending');
    el.classList.toggle('cp-spec-value--optional-empty', kind === 'optional-empty');
  }

  function truncate(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
  }

  function refresh() {
    var prompt = (document.getElementById('productPrompt') || {}).value || '';
    var promptTrim = String(prompt).trim();
    setVal('prompt', truncate(promptTrim, 32) || t('customProduct.specEmpty', '未填'), promptTrim ? false : 'optional-empty');

    var main = '';
    var sub = '';
    var $ = window.jQuery;
    if ($) {
      main = ($('#imageCategoryMainList .cat-option.selected').first().text() || '').trim();
      sub = ($('#imageCategorySubList .cat-option.selected').first().text() || '').trim();
      if (!main) {
        var mk = ($('#imageCategoryMainSelect').val() || '').trim();
        if (mk) main = ($('#imageCategoryMainList .cat-option[data-key="' + mk.replace(/"/g, '\\"') + '"]').text() || '').trim() || mk;
      }
      if (!sub) {
        var sk = ($('#imageCategorySubSelect').val() || '').trim();
        if (sk) sub = ($('#imageCategorySubList .cat-option[data-key="' + sk.replace(/"/g, '\\"') + '"]').text() || '').trim() || sk;
      }
    } else {
      main = (document.getElementById('imageCategoryMainSelect') || {}).value || '';
      sub = (document.getElementById('imageCategorySubSelect') || {}).value || '';
    }
    if (main && sub) setVal('category', main + ' · ' + sub, false);
    else if (main) setVal('category', main, false);
    else setVal('category', t('customProduct.specUnselected', '未選'), true);

    var refRoot = document.getElementById('refIntentSlots');
    var slotParts = [];
    if (typeof window.__countRefImagesBySlot === 'function') {
      try { slotParts = window.__countRefImagesBySlot() || []; } catch (e) { slotParts = []; }
    }
    if (!slotParts.length && refRoot) {
      var slotOrder = [
        { key: 'prototype', tabKey: 'customProduct.refSlotPrototypeTab', fb: '原型' },
        { key: 'material', tabKey: 'customProduct.refSlotMaterialTab', fb: '材料' },
        { key: 'part', tabKey: 'customProduct.refSlotPartTab', fb: '配件' },
        { key: 'pattern_print', tabKey: 'customProduct.refSlotPatternPrintTab', fb: '原圖印刷' },
        { key: 'pattern_style', tabKey: 'customProduct.refSlotPatternStyleTab', fb: '風格參考' }
      ];
      slotOrder.forEach(function (def) {
        var btn = refRoot.querySelector('.ref-intent-tab-btn[data-ref-tab="' + def.key + '"]');
        if (!btn) return;
        var badge = btn.querySelector('.ref-intent-tab-badge');
        var n = badge ? parseInt((badge.textContent || '').trim(), 10) : 0;
        if (n > 0) slotParts.push({ key: def.key, n: n, label: t(def.tabKey, def.fb) });
      });
    }
    var refsText = slotParts.length
      ? slotParts.map(function (p) {
          return tf('customProduct.specRefsSlotItem', '{slot} {n} 張', { slot: p.label, n: p.n });
        }).join(' · ')
      : t('customProduct.specUnselected', '未選');
    setVal('refs', refsText, slotParts.length ? false : 'optional-empty');

    var seed = (document.getElementById('generationSeed') || {}).value;
    setVal('seed', seed !== undefined && String(seed).trim() !== '' ? ('Seed ' + String(seed).trim()) : t('customProduct.specSeedRandom', '隨機'));
  }

  function bind() {
    var root = document.getElementById('custom-product') || document.getElementById('panel-product-design') || document.body;
    root.addEventListener('input', refresh);
    root.addEventListener('change', refresh);
    root.addEventListener('click', function () { setTimeout(refresh, 0); });
    if (window.jQuery) {
      window.jQuery(document).on('change', '#imageCategoryMainSelect, #imageCategorySubSelect, #productPrompt, #generationSeed', refresh);
      window.jQuery(document).on('click', '#imageCategoryMainList .cat-option, #imageCategorySubList .cat-option', function () {
        setTimeout(refresh, 0);
      });
    }
    var refRoot = document.getElementById('refIntentSlots');
    if (refRoot && typeof MutationObserver !== 'undefined') {
      try {
        new MutationObserver(function () { refresh(); }).observe(refRoot, { childList: true, subtree: true });
      } catch (e) {}
    }
    refresh();
    setTimeout(refresh, 500);
    setTimeout(refresh, 1500);
    if (window.i18n && window.i18n.ready) {
      window.i18n.ready.then(refresh);
    }
  }

  window.CustomProductSpecSummary = { refresh: refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
