/**
 * 商攝導演 — 規格卡標題旁顯示目前設定值（僅 UI 摘要，不改 state／API）
 */
(function () {
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback != null ? fallback : key;
  }

  function tpl(key, fallback, vars) {
    var s = t(key, fallback);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

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
    return s.slice(0, Math.max(1, n - 1)) + '…';
  }

  function refresh() {
    var refN = thumbCount('pcSelectedThumbs');
    var stagingN = thumbCount('pcStagingProductThumbs');
    var refs = refN
      ? tpl('promoCamera.specRefsSelected', '已選 {n} 張', { n: refN })
      : t('promoCamera.specNone', '未選');
    if (stagingN) refs += ' · ' + tpl('promoCamera.specProps', '道具 {n}', { n: stagingN });
    setVal('refs', refs, !refN);

    var useType = textOfSelect('pcSpaceUseType');
    var outLayout = document.getElementById('pcSpaceOutLayout');
    var outEye = document.getElementById('pcSpaceOutEye');
    var outLabel = '';
    if (outEye && outEye.checked) {
      var eyeLab = document.querySelector('label[for="pcSpaceOutEye"]');
      outLabel = eyeLab ? eyeLab.textContent.trim() : t('promoCamera.spaceOutEye', '平視攝影（對照 ISO）');
    } else if (outLayout && outLayout.checked) {
      var layLab = document.querySelector('label[for="pcSpaceOutLayout"]');
      outLabel = layLab ? layLab.textContent.trim() : t('promoCamera.spaceOutLayout', 'ISO 空間地圖');
    }
    setVal('spaceSetup', joinParts([useType, outLabel]));

    var mapN = thumbCount('pcLayoutThumbs');
    var mapTxt = mapN ? t('promoCamera.mapSelected', '已選地圖') : t('promoCamera.specNone', '未選');
    setVal('spaceMap', mapTxt, !mapN);

    var floorN = thumbCount('pcSpaceThumbs');
    var viewRadio = document.querySelector('input[name="pcSpaceLayoutView"]:checked');
    var viewLabel = '';
    if (viewRadio) {
      var vl = document.querySelector('label[for="' + viewRadio.id + '"]');
      viewLabel = vl ? vl.textContent.trim() : viewRadio.value;
    }
    var styleRadio = document.querySelector('input[name="pcSpaceStyleSource"]:checked');
    var styleLabel = styleRadio && styleRadio.value === 'image'
      ? t('promoCamera.styleImage', '風格圖')
      : t('promoCamera.stylePrompt', '文字風格');
    setVal('spaceLayout',
      joinParts([
        floorN ? t('promoCamera.layoutSelected', '已選配置') : t('promoCamera.layoutNone', '未選配置'),
        viewLabel,
        styleLabel
      ]),
      !floorN
    );

    var planN = thumbCount('pcPlanningSimThumb');
    setVal(
      'planningSim',
      planN ? t('promoCamera.planningSimSelected', '已選圖') : t('promoCamera.planningSimNone', '未選'),
      !planN ? 'optional-empty' : false
    );

    var theme = textOfSelect('pcThemeSelect');
    var scene = textOfSelect('pcSceneSelect');
    var sceneRefN = thumbCount('pcSceneRefThumbs');
    var themeParts = [theme || t('promoCamera.themeNone', '主題未選')];
    if (sceneRefN) themeParts.push(t('promoCamera.sceneRefShort', '場景參考圖'));
    else if (scene) themeParts.push(scene);
    setVal('themeScene', joinParts(themeParts), !theme);

    var moodEl = document.getElementById('pcPortraitRenderMood');
    var hybridEl = document.getElementById('pcPortraitRenderHybrid');
    var renderLabel = t('promoCamera.renderClearShort', '清晰');
    if (hybridEl && hybridEl.checked) renderLabel = t('promoCamera.renderHybridShort', '混合') + ' BETA';
    else if (moodEl && moodEl.checked) renderLabel = t('promoCamera.renderMoodShort', '氛圍');
    if ((moodEl && moodEl.checked) || (hybridEl && hybridEl.checked)) {
      var peopleLab = textOfSelect('pcPortraitPeopleCount');
      var genderLab = textOfSelect('pcPortraitSubjectGender');
      renderLabel = joinParts([renderLabel, peopleLab, genderLab]);
    }
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
    setVal('prompt', truncate(promptTrim, 28) || t('promoCamera.promptEmpty', '未填'), promptTrim ? false : 'optional-empty');
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
    refresh();
  }

  window.PromoCameraSpecSummary = {
    refresh: refresh,
    bind: bind
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
