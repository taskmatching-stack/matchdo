/**
 * 商攝導演 — 規格卡標題旁顯示目前設定值（僅 UI 摘要，不改 state／API）
 */
(function () {
  function textOfSelect(id) {
    var el = document.getElementById(id);
    if (!el || el.tagName !== 'SELECT') return '';
    var opt = el.options[el.selectedIndex];
    return opt ? String(opt.textContent || '').trim() : '';
  }

  function setVal(key, text, pending) {
    var el = document.querySelector('#promo-camera-app .pc-spec-value[data-pc-spec="' + key + '"]');
    if (!el) return;
    el.textContent = text || '—';
    var kind = pending === 'optional-empty' ? 'optional-empty' : (pending ? 'pending' : '');
    el.classList.toggle('pc-spec-value--pending', kind === 'pending');
    el.classList.toggle('pc-spec-value--optional-empty', kind === 'optional-empty');
  }

  function thumbCount(id) {
    var root = document.getElementById(id);
    if (!root) return 0;
    return root.querySelectorAll('img, .pc-thumb, [data-pc-thumb]').length || root.children.length;
  }

  function activeAngleLabel() {
    var btn = document.querySelector('#pcAngleBtns .pc-angle-btn.active, #pcAngleBtns button.active');
    if (!btn) return '';
    return String(btn.textContent || btn.getAttribute('title') || '').trim();
  }

  function joinParts(parts) {
    return parts.filter(Boolean).join(' · ') || '—';
  }

  function truncate(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
  }

  function refresh() {
    var refN = thumbCount('pcSelectedThumbs');
    var stagingN = thumbCount('pcStagingProductThumbs');
    var refs = refN ? ('已選 ' + refN + ' 張') : '未選';
    if (stagingN) refs += ' · 道具 ' + stagingN;
    setVal('refs', refs, !refN);

    var use = textOfSelect('pcSpaceUseType');
    var outRadio = document.querySelector('input[name="pcSpaceOutputType"]:checked');
    var outLabel = '';
    if (outRadio) {
      var ol = document.querySelector('label[for="' + outRadio.id + '"]');
      outLabel = ol ? ol.textContent.trim() : outRadio.value;
    }
    setVal('spaceSetup', joinParts([use, outLabel]));

    var mapN = thumbCount('pcLayoutThumbs');
    var from = textOfSelect('pcSpaceLookFrom');
    var to = textOfSelect('pcSpaceLookTo');
    var mapTxt = mapN ? '已選地圖' : '未選';
    if (from && to) mapTxt += ' · ' + from + '→' + to;
    setVal('spaceMap', mapTxt, !mapN);

    var floorN = thumbCount('pcSpaceThumbs');
    var viewRadio = document.querySelector('input[name="pcSpaceLayoutView"]:checked');
    var viewLabel = '';
    if (viewRadio) {
      var vl = document.querySelector('label[for="' + viewRadio.id + '"]');
      viewLabel = vl ? vl.textContent.trim() : viewRadio.value;
    }
    var styleRadio = document.querySelector('input[name="pcSpaceStyleSource"]:checked');
    var styleLabel = styleRadio && styleRadio.value === 'image' ? '風格圖' : '文字風格';
    setVal('spaceLayout', joinParts([floorN ? '已選配置' : '未選配置', viewLabel, styleLabel]), !floorN);

    var theme = textOfSelect('pcThemeSelect');
    var scene = textOfSelect('pcSceneSelect');
    var sceneRefN = thumbCount('pcSceneRefThumbs');
    var moodEl = document.getElementById('pcPortraitRenderMood');
    var isMood = !!(moodEl && moodEl.checked);
    var themeParts = isMood ? [] : [theme || '主題未選'];
    if (sceneRefN) themeParts.push('場景參考圖');
    else if (scene) themeParts.push(scene);
    if (!themeParts.length) themeParts.push(isMood ? '依場景' : '主題未選');
    setVal('themeScene', joinParts(themeParts), isMood ? false : !theme);

    var renderMode = document.getElementById('pcPortraitRenderMood');
    var renderLabel = (renderMode && renderMode.checked) ? '氛圍' : '清晰';
    var renderWrap = document.querySelector('.pc-portrait-only');
    if (renderWrap && !renderWrap.classList.contains('d-none')) {
      setVal('portraitRender', renderLabel);
    }

    var preserve = textOfSelect('pcPreserveSubjects');
    var angle = activeAngleLabel();
    setVal('shootSettings', joinParts([preserve, angle]));

    var ratio = textOfSelect('pcRatioSelect');
    var mp = textOfSelect('pcMpSelect');
    var dims = (document.getElementById('pcDimsHint') || {}).textContent || '';
    dims = String(dims).trim();
    setVal('productOut', joinParts([ratio, mp, dims]));

    var sRatio = textOfSelect('pcSpaceRatioSelect');
    var sMp = textOfSelect('pcSpaceMpSelect');
    var sDims = String((document.getElementById('pcSpaceDimsHint') || {}).textContent || '').trim();
    var count = textOfSelect('pcPortraitCount');
    var spaceOutParts = [sRatio, sMp, sDims];
    var batchWrap = document.querySelector('.pc-portrait-batch-only');
    if (batchWrap && !batchWrap.classList.contains('d-none') && count) spaceOutParts.push(count);
    setVal('spaceOut', joinParts(spaceOutParts));

    var prompt = (document.getElementById('pcPromptInput') || {}).value || '';
    var promptTrim = String(prompt).trim();
    setVal('prompt', truncate(promptTrim, 28) || '未填', promptTrim ? false : 'optional-empty');
  }

  function bind() {
    var root = document.getElementById('promo-camera-app');
    if (!root) return;
    root.addEventListener('change', refresh);
    root.addEventListener('input', refresh);
    root.addEventListener('click', function (e) {
      if (e.target && (e.target.closest('#pcAngleBtns') || e.target.closest('.pc-shoot-mode-tabs') || e.target.closest('.pc-remove-img') || e.target.closest('[id$="Thumbs"]'))) {
        setTimeout(refresh, 0);
      }
    });
    document.addEventListener('matchdo-pc-preset-applied', function () {
      setTimeout(refresh, 50);
    });
    ['pcSelectedThumbs', 'pcStagingProductThumbs', 'pcLayoutThumbs', 'pcSpaceThumbs', 'pcSceneRefThumbs'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || typeof MutationObserver === 'undefined') return;
      try {
        new MutationObserver(function () { refresh(); }).observe(el, { childList: true, subtree: true });
      } catch (e) {}
    });
    refresh();
    setTimeout(refresh, 400);
    setTimeout(refresh, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
