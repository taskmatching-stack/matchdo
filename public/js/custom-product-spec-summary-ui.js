/**
 * 設計稿 — 規格卡標題旁顯示目前設定值（僅 UI 摘要）
 */
(function () {
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
    setVal('prompt', truncate(promptTrim, 32) || '未填', promptTrim ? false : 'optional-empty');

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
    else setVal('category', '未選', true);

    var refRoot = document.getElementById('refIntentSlots');
    var n = 0;
    if (refRoot) n = refRoot.querySelectorAll('.ref-intent-thumb:not(.ref-intent-thumb-add) img, .ref-intent-thumb-cell img').length;
    setVal('refs', n ? ('已選 ' + n + ' 張') : '未選', n ? false : 'optional-empty');

    var seed = (document.getElementById('generationSeed') || {}).value;
    setVal('seed', seed !== undefined && String(seed).trim() !== '' ? ('Seed ' + String(seed).trim()) : '隨機');
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
