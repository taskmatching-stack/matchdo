/**
 * 攝影模擬 — 頁面初始化
 */
(function () {
  'use strict';

        window.__MATCHDO_PROMO_CAMERA_BUILD = 'promo-camera-ratio-32-20260812';

  var CAMERA_IMG = {
    film: '/img/cam-film.png',
    digitalOff: '/img/cam-lcd-off.png',
    digitalOn: '/img/cam-lcd-on.png'
  };

  var lcdPowered = true;

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

  function apiLang() {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh-TW';
    return lang === 'en' ? 'en' : 'zh';
  }

  function appendLangToUrl(url) {
    if (apiLang() !== 'en') return url;
    var hash = '';
    var hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      hash = url.slice(hashIdx);
      url = url.slice(0, hashIdx);
    }
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'lang=en' + hash;
  }

  function isEmbedDesign() {
    return new URLSearchParams(window.location.search).get('embed') === 'design';
  }

  function isVendorBack() {
    return new URLSearchParams(window.location.search).get('back') === 'vendor';
  }

  function backHref() {
    if (isVendorBack()) return appendLangToUrl('/client/manufacturer-materials.html#tab-promo');
    return appendLangToUrl('/custom-product.html?tab=promo-image');
  }

  function resultNoteHtml() {
    return '<p class="scene-sim-result-note text-muted small mt-2 mb-0">' +
      esc(t('promoCamera.resultNote', '生成後可下載，並儲存至「我的數位資產 → 情境圖」。')) + '</p>';
  }

  function resultPanelOpts(extra) {
    var base = {
      resultNoteHtml: resultNoteHtml(),
      actions: {
        labels: {
          download: t('promoCamera.download', '下載'),
          save: t('promoCamera.save', '儲存到數位資產庫'),
          saved: t('promoCamera.saved', '已儲存'),
          viewLibrary: t('promoCamera.viewLibrary', '查看情境圖')
        },
        libraryHref: appendLangToUrl('/client/my-custom-products.html?tab=promo')
      }
    };
    if (!extra) return base;
    Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  var SUBJECT_FALLBACK = [
    { key: 'keep', name: '保留', name_en: 'Keep', description: '若源圖有人物、手、寵物或動物，輸出時保留；細節可依描述調整。', description_en: 'If the reference shows people, hands, pets, or animals, preserve them in the output; follow the user prompt for styling details when provided.' },
    { key: 'exclude', name: '不含', name_en: 'None', description: '輸出僅保留產品與中性環境，移除源圖中的人物、手、寵物或動物。', description_en: 'Show only the product and neutral environment; remove any people, hands, pets, or animals from the reference.' },
    { key: 'prompt', name: '依提示詞', name_en: 'From prompt', description: '不複製源圖人物或動物；若描述中有寫人物／動物，才依提示詞全新創作。', description_en: 'Do not copy people or animals from the reference; include human or animal subjects only when explicitly described in your prompt, composed freshly.' }
  ];

  var ANGLE_FALLBACK = [
    { key: 'keep_reference', name: '維持參考角度', name_en: 'Keep reference angle', description: '維持參考圖中產品最完整的呈現視角，不另改拍攝角度。', description_en: 'Preserve the reference\'s most complete product presentation angle; do not reshoot from a different viewpoint.' },
    { key: 'hero_34', name: '45° 英雄角', name_en: 'Hero 3/4 angle', description: '同一產品改為 45° 英雄角，主視覺面清楚。', description_en: 'Reshoot the same product at a hero 3/4 angle with the primary selling face clearly visible.' },
    { key: 'front', name: '正視', name_en: 'Front facing', description: '同一產品改為正面對鏡頭。', description_en: 'Reshoot the same product straight-on from the front.' },
    { key: 'side_profile', name: '側面', name_en: 'Side profile', description: '同一產品改為側面輪廓。', description_en: 'Reshoot the same product from a clean side profile.' },
    { key: 'top_down', name: '俯拍', name_en: 'Top down', description: '同一產品改為俯拍／平拍視角。', description_en: 'Reshoot the same product from a top-down flat-lay angle.' },
    { key: 'low_angle', name: '低角度', name_en: 'Low angle', description: '同一產品改為低角度仰拍。', description_en: 'Reshoot the same product from a low upward angle for a hero presence.' },
    { key: 'back_34', name: '後 3/4', name_en: 'Rear 3/4', description: '同一產品改為後 3/4 角度。', description_en: 'Reshoot the same product from a rear three-quarter angle.' }
  ];

  function localizedOptionDescription(row) {
    if (!row) return '';
    if (apiLang() === 'en') {
      var meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      var en = String(row.description_en || meta.description_en || '').trim();
      return en;
    }
    return String(row.description || '').trim();
  }

  function localizedOptionName(row) {
    if (!row) return '';
    if (apiLang() === 'en') {
      var meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      var en = String(row.name_en || meta.name_en || '').trim();
      if (en) return en;
    }
    return String(row.name || row.key || '').trim();
  }

  function angleOptionList() {
    var angleCat = St.getAngleCategory ? St.getAngleCategory() : 'shooting_angle';
    var fromApi = (St.get().options && St.get().options.camera_params) ? St.get().options.camera_params[angleCat] || [] : [];
    if (fromApi.length) return fromApi;
    return ANGLE_FALLBACK;
  }

  function subjectOptionList() {
    var subjectCat = St.getSubjectPreservationCategory ? St.getSubjectPreservationCategory() : 'subject_preservation';
    var fromApi = (St.get().options && St.get().options.camera_params) ? St.get().options.camera_params[subjectCat] || [] : [];
    if (fromApi.length) return fromApi;
    return SUBJECT_FALLBACK;
  }

  function fillPreserveSubjectsSelect() {
    var sel = document.getElementById('pcPreserveSubjects');
    if (!sel) return;
    var subjectCat = St.getSubjectPreservationCategory ? St.getSubjectPreservationCategory() : 'subject_preservation';
    var current = (St.get().camera || {})[subjectCat] || 'keep';
    var list = subjectOptionList();
    sel.innerHTML = list.map(function (row) {
      var label = localizedOptionName(row);
      return '<option value="' + esc(row.key) + '">' + esc(label) + '</option>';
    }).join('');
    if (list.some(function (r) { return r.key === current; })) sel.value = current;
    else sel.value = list[0] ? list[0].key : 'keep';
    refreshPreserveSubjectsHint();
  }

  function refreshPreserveSubjectsHint() {
    var sel = document.getElementById('pcPreserveSubjects');
    if (!sel) return;
    var list = subjectOptionList();
    var hit = list.find(function (r) { return r.key === sel.value; });
    var hint = localizedOptionDescription(hit);
    sel.title = hint || '';
    sel.setAttribute('aria-label', t('promoCamera.preserveSubjectsLabel', '人物／動物'));
  }

  function bindPreserveSubjectsSelect() {
    var sel = document.getElementById('pcPreserveSubjects');
    if (!sel || sel.getAttribute('data-pc-bound') === '1') return;
    sel.setAttribute('data-pc-bound', '1');
    sel.addEventListener('change', function () {
      var subjectCat = St.getSubjectPreservationCategory ? St.getSubjectPreservationCategory() : 'subject_preservation';
      St.setCameraKey(subjectCat, sel.value);
      refreshPreserveSubjectsHint();
    });
  }

  var Api = window.PromoCameraApi;
  var St = window.PromoCameraState;
  var Promo = window.MatchdoPromoImage;
  if (!Api || !St || !Promo) return;

  var assetModal = null;
  var lcdFlashTimer = null;
  var dialPulseTimer = null;

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function showBootstrapModal(el) {
    if (!el || typeof bootstrap === 'undefined') return;
    if (!assetModal) assetModal = new bootstrap.Modal(el);
    assetModal.show();
  }

  function hideBootstrapModal(el) {
    if (assetModal) assetModal.hide();
  }

  function getChatPanel() {
    return document.querySelector('#promo-camera-app .pc-chat-panel');
  }

  function clearResultArea() {
    var el = document.getElementById('pcResultArea');
    var panel = getChatPanel();
    if (el) {
      el.classList.add('d-none');
      el.innerHTML = '';
      el.classList.remove('has-result');
    }
    if (panel) panel.classList.remove('has-result');
  }

  function updateBackLink() {
    var link = document.getElementById('pcBackLink');
    var label = document.getElementById('pcBackLabel');
    if (!link || isEmbedDesign()) return;
    link.setAttribute('href', backHref());
    if (label) {
      label.textContent = isVendorBack()
        ? t('promoCamera.backToMaterials', '返回素材庫')
        : t('promoCamera.backToScene', '返回情境圖');
    }
  }

  function showResultLoading() {
    var el = document.getElementById('pcResultArea');
    var panel = getChatPanel();
    if (!el || !Promo.renderPromoResultPanel) return;
    el.classList.remove('d-none');
    if (panel) panel.classList.add('has-result');
    Promo.renderPromoResultPanel(el, null, null, resultPanelOpts({ loadingText: t('promoCamera.loadingGenerate', '拍攝中…') }));
  }

  function showResultArea(url, data, payload) {
    if (data && data.batch && Array.isArray(data.results) && data.results.length > 1) {
      showPortraitBatchResults(data, payload);
      return;
    }
    var el = document.getElementById('pcResultArea');
    var panel = getChatPanel();
    if (!el || !url || !Promo.renderPromoResultPanel) return;
    el.classList.remove('d-none');
    if (panel) panel.classList.add('has-result');
    var compareRef = (data && data.compare_ref_url) || null;
    if (!compareRef && payload && payload.shoot_mode === 'space' && payload.space_output_type === 'layout_plan' && St.get().floorPlanImage) {
      compareRef = St.get().floorPlanImage;
    }
    var meta = Object.assign({}, data || {}, {
      aspect_ratio: payload.aspect_ratio,
      theme_key: payload.theme_key,
      scene_key: payload.scene_key,
      user_prompt: payload.user_prompt,
      compare_ref_url: compareRef,
      compare_ref_label: (data && data.compare_ref_label) || (payload.space_output_type === 'eye_level' ? 'ISO 空間地圖' : '平面配置圖'),
      compare_result_label: (data && data.compare_result_label) || (payload.space_output_type === 'eye_level'
        ? '平視攝影'
        : (payload.space_layout_view === 'top_down' ? '俯視空間地圖' : 'ISO 空間地圖'))
    });
    Promo.renderPromoResultPanel(el, data.imageData || url, meta, resultPanelOpts());
    if (data && data.space_output_type === 'layout_plan' && (data.image_url || url)) {
      var layoutSrc = data.image_url || url;
      var layoutGenId = data.layout_generation_id || data.id || null;
      ensureLayoutImageDataUrl(layoutSrc).then(function (dataUrl) {
        St.setLayoutReference(dataUrl, layoutGenId);
        renderLayoutRefThumbs();
      }).catch(function () {
        St.setLayoutReference(layoutSrc, layoutGenId);
        renderLayoutRefThumbs();
      });
    }
  }

  function showPortraitBatchResults(data, payload) {
    var el = document.getElementById('pcResultArea');
    var panel = getChatPanel();
    if (!el) return;
    el.classList.remove('d-none');
    if (panel) panel.classList.add('has-result');
    var ok = (data.results || []).filter(function (r) { return r.success && (r.image_url || r.imageData); });
    if (!ok.length) {
      showResultError('人像套圖生成失敗');
      return;
    }
    el.classList.add('has-result');
    el.innerHTML = '';
    var inner = document.createElement('div');
    inner.className = 'scene-sim-result-inner';
    var title = document.createElement('p');
    title.className = 'small text-muted mb-2';
    title.textContent = '人像套圖 ' + ok.length + ' 張（構圖自動變化；描述欄為共用造型）';
    inner.appendChild(title);
    var grid = document.createElement('div');
    grid.className = 'pc-portrait-batch';
    ok.forEach(function (r, idx) {
      var item = document.createElement('div');
      item.className = 'pc-portrait-batch-item';
      var label = document.createElement('p');
      label.className = 'small text-muted mb-1';
      label.textContent = '第 ' + (r.shot_index || (idx + 1)) + ' 張';
      var img = document.createElement('img');
      img.src = r.image_url || r.imageData;
      img.alt = '人像套圖 ' + (r.shot_index || (idx + 1));
      img.className = 'img-fluid border js-preview-enlarge matchdo-enlarge-trigger';
      item.appendChild(label);
      item.appendChild(img);
      grid.appendChild(item);
    });
    inner.appendChild(grid);
    if (data.points_deducted != null) {
      var pts = document.createElement('p');
      pts.className = 'small text-muted mt-2 mb-0';
      pts.textContent = '已扣除 ' + data.points_deducted + ' 點';
      inner.appendChild(pts);
    }
    el.appendChild(inner);
  }

  function showResultError(msg) {
    var el = document.getElementById('pcResultArea');
    var panel = getChatPanel();
    if (!el || !Promo.renderPromoResultPanel) return;
    el.classList.remove('d-none');
    if (panel) panel.classList.add('has-result');
    Promo.renderPromoResultPanel(el, null, null, resultPanelOpts({ errorText: msg || t('promoCamera.generateFailedShort', '生成失敗') }));
  }

  function renderMessages() {
    var wrap = document.getElementById('pcChatMessages');
    if (!wrap) return;
    var msgs = St.cloneMessages();
    if (!msgs.length) {
      wrap.innerHTML = '<div class="pc-msg pc-msg-system">' + chatWelcomeHtml() + '</div>';
      return;
    }
    wrap.innerHTML = msgs.map(function (m) {
      var cls = m.role === 'user' ? 'pc-msg-user' : (m.role === 'assistant' ? 'pc-msg-assistant' : 'pc-msg-system');
      var html = '<div class="pc-msg ' + cls + '">';
      if (m.extra && m.extra.thumbs && m.extra.thumbs.length) {
        html += '<div class="d-flex flex-wrap gap-1 mb-1">';
        m.extra.thumbs.forEach(function (u) {
          html += '<img class="pc-thumb" src="' + esc(u) + '" alt="">';
        });
        html += '</div>';
      }
      if (m.text) html += '<div class="small mb-0">' + esc(m.text) + '</div>';
      html += '</div>';
      return html;
    }).join('');
    wrap.scrollTop = wrap.scrollHeight;
  }

  function getShootMode() {
    return St.get().shootMode || 'product';
  }

  function isSpaceMode() {
    return getShootMode() === 'space';
  }

  function isPortraitMode() {
    return getShootMode() === 'portrait';
  }

  function isFluxShootMode() {
    return !isSpaceMode();
  }

  function isSpaceEyeLevel() {
    return isSpaceMode() && (St.get().spaceOutputType === 'eye_level');
  }

  function themesForCurrentMode() {
    return St.getThemesForMode ? St.getThemesForMode(getShootMode()) : ((St.get().options && St.get().options.themes) || []);
  }

  function chatWelcomeHtml() {
    if (isSpaceMode()) {
      if (isSpaceEyeLevel()) {
        return '請選 <strong>ISO 空間地圖</strong>，在地圖上標 <strong>A／B／C／D</strong>，預設<strong>從 B 看向 C</strong> 生成低視角平視。';
      }
      return '請上傳<strong>平面配置圖</strong>，並以文字或風格參考圖描述空間風格。';
    }
    if (isPortraitMode()) {
      return '請上傳<strong>一張</strong>人像參考圖，選擇<strong>拍攝主題</strong>（必填），並在描述中調整服裝／髮型。右側可調相機光學參數。';
    }
    return t('promoCamera.chatWelcome', '請上傳<strong>一張</strong>產品參考圖，或從數位資產選擇。右側可調相機光學參數（純畫質模擬）。');
  }

  function fillSpaceUseTypes() {
    var sel = document.getElementById('pcSpaceUseType');
    var opts = St.get().options;
    if (!sel || !opts || !opts.space_use_types) return;
    Promo.fillSelect(sel, opts.space_use_types, 'key', 'name', '');
    sel.value = St.get().spaceUseType || 'residential';
  }

  function applySpaceOutputUi() {
    var space = isSpaceMode();
    var eye = isSpaceEyeLevel();
    document.querySelectorAll('.pc-space-layout-only').forEach(function (el) {
      el.classList.toggle('d-none', !space || eye);
    });
    document.querySelectorAll('.pc-space-eye-only').forEach(function (el) {
      el.classList.toggle('d-none', !space || !eye);
    });
    var outLayout = document.getElementById('pcSpaceOutLayout');
    var outEye = document.getElementById('pcSpaceOutEye');
    if (outLayout) outLayout.checked = !eye;
    if (outEye) outEye.checked = eye;
    var layoutIso = document.getElementById('pcSpaceLayoutIso');
    var layoutTop = document.getElementById('pcSpaceLayoutTop');
    var layoutView = St.get().spaceLayoutView || 'iso_45';
    if (layoutIso) layoutIso.checked = layoutView !== 'top_down';
    if (layoutTop) layoutTop.checked = layoutView === 'top_down';

    var promptEl = document.getElementById('pcPromptInput');
    var hintEl = document.getElementById('pcPromptHint');
    var promptLabel = document.querySelector('label[for="pcPromptInput"]');
    var genBtn = document.getElementById('pcGenerateBtn');
    if (!space) return;
    if (eye) {
      if (promptLabel) promptLabel.textContent = '補充描述（選填）';
      if (promptEl) promptEl.placeholder = '選填';
      if (hintEl) hintEl.textContent = '打字母→確定標註→右側調相機參數→生成。相機參數會組進提示詞（鏡頭／光圈／EV／底片）。';
      if (genBtn) {
        var spanEye = genBtn.querySelector('span');
        if (spanEye) spanEye.textContent = '生成平視攝影';
      }
      renderSpaceMapMarkStage();
      syncSpaceMarkConfirmUi();
    } else {
      if (promptLabel) promptLabel.textContent = St.get().spaceStyleSource === 'image' ? '補充描述（選填）' : '風格描述';
      if (promptEl) promptEl.placeholder = promptEl.getAttribute('data-space-placeholder') || '例：莫蘭迪配色';
      if (hintEl) hintEl.textContent = '';
      if (genBtn) {
        var spanLay = genBtn.querySelector('span');
        if (spanLay) {
          spanLay.textContent = (St.get().spaceLayoutView === 'top_down')
            ? '生成俯視空間地圖'
            : '生成 ISO 空間地圖';
        }
      }
      var styleImgRow = document.getElementById('pcSpaceStyleImageRow');
      if (styleImgRow) styleImgRow.classList.toggle('d-none', St.get().spaceStyleSource !== 'image');
    }
    renderLayoutRefThumbs();
    updateSpaceOutputPanel();
    refreshSpaceMpSelectLabels();
    updateGenerateBtn();
  }

  function syncOutputCountSelects() {
    var n = String(St.get().outputCount || 1);
    var portraitEl = document.getElementById('pcPortraitCount');
    if (portraitEl) portraitEl.value = n;
  }

  function spacePointsForTier(opts, outputType, tier) {
    var o = opts || {};
    var t = String(tier || '2k').toLowerCase() === '4k' ? '4k' : '2k';
    if (outputType === 'eye_level') {
      return t === '4k'
        ? (o.points_space_eye_level_4k != null ? o.points_space_eye_level_4k : 50)
        : (o.points_space_eye_level != null ? o.points_space_eye_level : 30);
    }
    return t === '4k'
      ? (o.points_space_layout_4k != null ? o.points_space_layout_4k : 50)
      : (o.points_space_layout != null ? o.points_space_layout : 30);
  }

  function refreshSpaceMpSelectLabels() {
    var mpEl = document.getElementById('pcSpaceMpSelect');
    if (!mpEl) return;
    var opts = St.get().options || {};
    var eye = isSpaceEyeLevel();
    var pts4 = spacePointsForTier(opts, eye ? 'eye_level' : 'layout_plan', '2k');
    var pts16 = spacePointsForTier(opts, eye ? 'eye_level' : 'layout_plan', '4k');
    Array.prototype.forEach.call(mpEl.options, function (opt) {
      if (opt.value === '4') opt.textContent = '4 MP（' + pts4 + ' 點／張）';
      if (opt.value === '16') opt.textContent = '16 MP（' + pts16 + ' 點／張）';
    });
    if (window.PromoCameraAppShell && typeof window.PromoCameraAppShell.renderSpaceMpChips === 'function') {
      window.PromoCameraAppShell.renderSpaceMpChips();
    }
  }

  function formatSpaceDimsHint(st) {
    var opts = St.get().options || {};
    var outputType = isSpaceEyeLevel() ? 'eye_level' : 'layout_plan';
    var tier = st.spaceResolutionTier || '2k';
    var pts = spacePointsForTier(opts, outputType, tier);
    var dims = Promo && typeof Promo.dimsForSpaceRatio === 'function'
      ? Promo.dimsForSpaceRatio(st.aspectRatio || '1:1', tier)
      : { w: st.width, h: st.height, mp: st.megapixels };
    var mp = dims.mp || (Promo && Promo.spaceMegapixelsFromTier ? Promo.spaceMegapixelsFromTier(tier) : (tier === '4k' ? 16 : 4));
    return dims.w + '×' + dims.h + ' · ' + mp + ' MP · ' + pts + ' 點／張';
  }

  function updateSpaceDimsHint() {
    var ratioEl = document.getElementById('pcSpaceRatioSelect');
    var mpEl = document.getElementById('pcSpaceMpSelect');
    var hint = document.getElementById('pcSpaceDimsHint');
    var ratio = (ratioEl && ratioEl.value) || St.get().aspectRatio || '1:1';
    var mp = (mpEl && mpEl.value) || '4';
    St.setSpaceAspectRatio(ratio);
    St.setSpaceMegapixels(mp);
    var st = St.get();
    if (hint) {
      hint.textContent = formatSpaceDimsHint(st);
    }
    refreshSpaceMpSelectLabels();
    updateSpaceOutputPanel();
    updatePoints();
  }

  function syncSpaceResolutionControls() {
    if (St.applySpaceDimensions) {
      St.applySpaceDimensions(St.get().aspectRatio || '1:1', St.get().spaceResolutionTier || '2k');
    }
    var ratioEl = document.getElementById('pcSpaceRatioSelect');
    var mpEl = document.getElementById('pcSpaceMpSelect');
    var st = St.get();
    if (ratioEl) ratioEl.value = st.aspectRatio || '1:1';
    if (mpEl) {
      var mpVal = Promo && Promo.spaceMegapixelsFromTier
        ? String(Promo.spaceMegapixelsFromTier(st.spaceResolutionTier || '2k'))
        : (st.spaceResolutionTier === '4k' ? '16' : '4');
      mpEl.value = mpVal;
    }
    var hint = document.getElementById('pcSpaceDimsHint');
    if (hint) {
      hint.textContent = formatSpaceDimsHint(st);
    }
    refreshSpaceMpSelectLabels();
  }
  function updateSpaceEyeBatchHint() {
    /* 區域批次已移除：字母＝區域 */
  }

  function updateSpaceOutputPanel() {
    var space = isSpaceMode();
    document.querySelectorAll('.pc-space-output-only').forEach(function (el) {
      el.classList.toggle('d-none', !space);
    });
    document.querySelectorAll('.pc-space-resolution-only').forEach(function (el) {
      el.classList.toggle('d-none', !space);
    });
    if (!space) return;

    document.querySelectorAll('.pc-space-eye-batch-only').forEach(function (el) {
      el.classList.add('d-none');
    });
    syncSpaceResolutionControls();
  }

  function updatePortraitBatchUi() {
    var portrait = isPortraitMode();
    document.querySelectorAll('.pc-portrait-batch-only').forEach(function (el) {
      el.classList.toggle('d-none', !portrait);
    });
    var hintEl = document.getElementById('pcPortraitCountHint');
    if (hintEl) hintEl.textContent = '';
    syncOutputCountSelects();
  }

  /**
   * 空間 layout_plan 與 eye_level 皆須顯示右側相機殼（參數進 Gemini prompt）。
   * 禁止依 spaceOutputType 隱藏 — docs/DO-NOT-hide-promo-space-camera-shell.md
   */
  function syncCameraShellVisibility() {
    document.querySelectorAll('#promo-camera-app .pc-camera-shell').forEach(function (el) {
      el.classList.remove('d-none');
    });
  }

  function applyShootModeUi() {
    var mode = getShootMode();
    var space = mode === 'space';
    var portrait = mode === 'portrait';
    var flux = !space;

    applySpaceOutputUi();

    document.querySelectorAll('.pc-flux-shoot-only').forEach(function (el) {
      el.classList.toggle('d-none', !flux);
    });
    document.querySelectorAll('.pc-product-only').forEach(function (el) {
      el.classList.toggle('d-none', mode !== 'product');
    });
    syncCameraShellVisibility();
    document.querySelectorAll('.pc-space-only').forEach(function (el) {
      el.classList.toggle('d-none', !space);
    });
    document.querySelectorAll('.pc-portrait-only').forEach(function (el) {
      el.classList.toggle('d-none', !portrait);
    });
    updateSpaceOutputPanel();
    updatePortraitBatchUi();
    document.querySelectorAll('.pc-staging-product-only').forEach(function (el) {
      el.classList.toggle('d-none', !(portrait || space));
    });

    if (space) {
      syncSpaceResolutionControls();
      updateSpaceDimsHint();
    }

    var prodBtn = document.getElementById('pcModeProduct');
    var spaceBtn = document.getElementById('pcModeSpace');
    var portraitBtn = document.getElementById('pcModePortrait');
    if (prodBtn) prodBtn.classList.toggle('active', mode === 'product');
    if (spaceBtn) spaceBtn.classList.toggle('active', space);
    if (portraitBtn) portraitBtn.classList.toggle('active', portrait);

    refreshThemesForMode();

    var uploadLabel = document.getElementById('pcUploadLabel');
    if (uploadLabel) {
      uploadLabel.textContent = portrait ? '上傳人像參考圖' : t('promoCamera.uploadImage', '上傳圖片');
    }

    var themeLabel = document.getElementById('pcThemeLabel');
    if (themeLabel) {
      themeLabel.textContent = portrait ? '拍攝主題（必填）' : t('promoCamera.theme', '主題');
    }

    var promptEl = document.getElementById('pcPromptInput');
    var hintEl = document.getElementById('pcPromptHint');
    var promptLabel = document.querySelector('label[for="pcPromptInput"]');
    if (space) {
      /* applySpaceOutputUi 已在函式開頭執行 */
    } else if (portrait) {
      if (promptLabel) promptLabel.textContent = '描述（服裝／髮型等）';
      if (promptEl) promptEl.placeholder = '例：白色西裝、俐落短髮、自然妝感';
      if (hintEl) hintEl.textContent = '';
      var genBtnP = document.getElementById('pcGenerateBtn');
      if (genBtnP) {
        var spanP = genBtnP.querySelector('span');
        if (spanP) spanP.textContent = t('promoCamera.generateBtn', '拍照');
      }
    } else {
      if (promptLabel) promptLabel.textContent = t('promoCamera.description', '描述');
      if (promptEl) promptEl.placeholder = t('promoCamera.descriptionPlaceholder', '例：皮革手提包，溫暖午後陽光、柔和陰影');
      if (hintEl) hintEl.textContent = t('promoCamera.descriptionHint', '請先寫產品名稱，再寫情境描述；參考圖較複雜時可避免誤判品項。');
      var genBtnD = document.getElementById('pcGenerateBtn');
      if (genBtnD) {
        var spanD = genBtnD.querySelector('span');
        if (spanD) spanD.textContent = t('promoCamera.generateBtn', '拍照');
      }
    }

    renderSpaceThumbs();
    renderSceneRefThumbs();
    syncPortraitSceneConflictUi();
    renderStagingProductThumbs();
    renderSelectedThumbs();
    updateGenerateBtn();
    updatePoints();
    renderMessages();

    if (space && window.PromoCameraAppShell && typeof window.PromoCameraAppShell.setComposeExpanded === 'function') {
      window.PromoCameraAppShell.setComposeExpanded(true);
    }
  }

  function refreshThemesForMode() {
    if (isSpaceMode()) return;
    var themes = themesForCurrentMode();
    var st = St.get();
    if (themes.length && !themes.some(function (t) { return t.key === st.themeKey; })) {
      st.themeKey = themes[0].key || '';
    }
    fillThemeSceneSelects(themes);
    var themeEl = document.getElementById('pcThemeSelect');
    if (themeEl && st.themeKey) themeEl.value = st.themeKey;
  }

  function setShootMode(mode) {
    St.setShootMode(mode);
    if (mode === 'space') {
      updateSpaceDimsHint();
    } else {
      updateDimsHint();
    }
    fillCameraSelects();
    renderAngleButtons();
    fillPreserveSubjectsSelect();
    updateLcd();
    applyShootModeUi();
    renderMessages();
  }

  function renderLayoutRefThumbs() {
    var wrap = document.getElementById('pcLayoutThumbs');
    if (!wrap) return;
    if (!isSpaceEyeLevel()) {
      wrap.innerHTML = '';
      renderSpaceMapMarkStage();
      return;
    }
    var url = St.get().layoutReferenceImage;
    if (!url) {
      wrap.innerHTML = '';
      renderSpaceMapMarkStage();
      return;
    }
    wrap.innerHTML = '<div class="position-relative d-inline-block">' +
      '<img class="pc-thumb" src="' + esc(url) + '" alt="">' +
      '<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1 pc-remove-layout" style="line-height:1;font-size:10px;">×</button>' +
      '<span class="badge bg-secondary position-absolute bottom-0 start-0 m-1">ISO</span></div>';
    var rm = wrap.querySelector('.pc-remove-layout');
    if (rm) {
      rm.addEventListener('click', function () {
        St.clearLayoutReference();
        if (St.setSpaceLabeledLayoutImage) St.setSpaceLabeledLayoutImage('');
        renderLayoutRefThumbs();
        updateGenerateBtn();
      });
    }
    renderSpaceMapMarkStage();
  }

  var _spaceMarkImg = null;
  var _spaceMarkImgUrl = '';
  var _spaceMarkNaturalW = 0;
  var _spaceMarkNaturalH = 0;

  function spaceMarkAlphabet() {
    var out = [];
    for (var i = 0; i < 26; i++) out.push(String.fromCharCode(65 + i));
    return out;
  }

  function fillSpaceLookSelects() {
    var fromEl = document.getElementById('pcSpaceLookFrom');
    var toEl = document.getElementById('pcSpaceLookTo');
    var letters = spaceMarkAlphabet();
    var fromVal = St.get().spaceLookFrom || 'B';
    var toVal = St.get().spaceLookTo || 'C';
    function fill(sel, cur) {
      if (!sel) return;
      sel.innerHTML = letters.map(function (L) {
        return '<option value="' + L + '"' + (L === cur ? ' selected' : '') + '>' + L + '</option>';
      }).join('');
      if (letters.indexOf(cur) >= 0) sel.value = cur;
    }
    fill(fromEl, fromVal);
    fill(toEl, toVal);
  }

  function syncSpaceMarkConfirmUi() {
    var confirmBtn = document.getElementById('pcSpaceMarkConfirm');
    var hint = document.getElementById('pcSpaceMapMarkHint');
    var ready = !!(St.hasSpaceLookMarkers && St.hasSpaceLookMarkers());
    var confirmed = !!(St.isSpaceMapMarkConfirmed && St.isSpaceMapMarkConfirmed());
    if (confirmBtn) {
      confirmBtn.disabled = !St.get().layoutReferenceImage || !ready || confirmed;
      confirmBtn.textContent = confirmed ? '已確定標註' : '確定標註';
      confirmBtn.classList.toggle('btn-primary', !confirmed);
      confirmBtn.classList.toggle('btn-success', confirmed);
    }
    if (hint) {
      var m = St.get().spaceMapMarkers || {};
      var placed = Object.keys(m).sort();
      if (confirmed) {
        hint.innerHTML = '已確定：從 <strong>' + (St.get().spaceLookFrom || '') +
          '</strong> 看向 <strong>' + (St.get().spaceLookTo || '') +
          '</strong>。可按「生成平視攝影」。改字母／站點後需再按確定。';
      } else if (!placed.length) {
        hint.textContent = '打完字母並選好站點／望向後，按「確定標註」。';
      } else if (!ready) {
        hint.innerHTML = '已標 <strong>' + placed.join('、') +
          '</strong>。請標齊站點與望向（且兩者不同），再按「確定標註」。';
      } else {
        hint.innerHTML = '已標 <strong>' + placed.join('、') +
          '</strong> · 從 <strong>' + (St.get().spaceLookFrom || 'B') +
          '</strong> 看向 <strong>' + (St.get().spaceLookTo || 'C') +
          '</strong> → 請按<strong>確定標註</strong>才算選完。';
      }
    }
    var dl = document.getElementById('pcSpaceMarkDownload');
    if (dl) {
      var hasMarks = Object.keys(St.get().spaceMapMarkers || {}).length > 0;
      dl.disabled = !St.get().layoutReferenceImage || !hasMarks;
    }
  }

  function syncSpaceMarkLetterButtons() {
    var letterEl = document.getElementById('pcSpaceMarkLetter');
    var active = (St.get().spaceMarkActiveLetter || 'A');
    if (letterEl && document.activeElement !== letterEl) letterEl.value = active;
    fillSpaceLookSelects();
    syncSpaceMarkConfirmUi();
  }

  function drawSpaceMapMarkersOnCanvas(ctx, w, h, markers) {
    var m = markers || {};
    Object.keys(m).sort().forEach(function (L) {
      var p = m[L];
      if (!p) return;
      var x = p.x * w;
      var y = p.y * h;
      var r = Math.max(16, Math.min(w, h) * 0.032);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 53, 69, 0.95)';
      ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.18);
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(r * 1.2) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(L, x, y + 1);
    });
  }

  /** 遠端圖轉 data URL，避免跨域無法把字母畫進參考圖 */
  function ensureLayoutImageDataUrl(url) {
    function blobToDataUrl(blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(new Error('讀取地圖失敗')); };
        reader.readAsDataURL(blob);
      });
    }
    function fetchToDataUrl(fetchUrl, withCreds) {
      return fetch(fetchUrl, {
        credentials: withCreds ? 'include' : 'omit',
        mode: 'cors',
        cache: 'force-cache'
      }).then(function (r) {
        if (!r.ok) throw new Error('fetch_failed');
        return r.blob();
      }).then(blobToDataUrl);
    }
    return new Promise(function (resolve, reject) {
      var src = String(url || '').trim();
      if (!src) return reject(new Error('缺少 ISO 地圖'));
      if (/^data:/i.test(src)) return resolve(src);
      if (src.indexOf(window.location.origin) === 0 || src.charAt(0) === '/') {
        fetchToDataUrl(src, true).then(resolve).catch(function () {
          reject(new Error('地圖讀取失敗'));
        });
        return;
      }
      /* 公開 CDN 回 ACAO:*，不可 credentials:include；失敗則走同源 proxy */
      fetchToDataUrl(src, false).then(resolve).catch(function () {
        var proxy = '/api/proxy-image?url=' + encodeURIComponent(src);
        fetchToDataUrl(proxy, true).then(resolve).catch(function () {
          reject(new Error('地圖跨域無法標註，請改用「上傳 ISO 地圖」'));
        });
      });
    });
  }

  function renderSpaceMapMarkStage() {
    var wrap = document.getElementById('pcSpaceMapMarkPaintWrap');
    var canvas = document.getElementById('pcSpaceMapMarkCanvas');
    var empty = document.getElementById('pcSpaceMapMarkEmpty');
    if (!wrap || !canvas) return;
    syncSpaceMarkLetterButtons();
    if (!isSpaceEyeLevel()) {
      wrap.classList.add('d-none');
      if (empty) empty.classList.add('d-none');
      return;
    }
    var url = St.get().layoutReferenceImage;
    if (!url) {
      wrap.classList.add('d-none');
      if (empty) {
        empty.classList.remove('d-none');
        empty.textContent = '請先選／上傳 ISO 地圖，再於圖上打字母';
      }
      return;
    }
    if (empty) empty.classList.add('d-none');
    wrap.classList.remove('d-none');

    function paintFromImg() {
      if (!_spaceMarkImg || !_spaceMarkImg.complete) return;
      _spaceMarkNaturalW = _spaceMarkImg.naturalWidth || 0;
      _spaceMarkNaturalH = _spaceMarkImg.naturalHeight || 0;
      if (!_spaceMarkNaturalW || !_spaceMarkNaturalH) return;
      /* 畫布像素＝原圖；CSS 依框寬／手機高度縮放（點擊座標走 getBoundingClientRect） */
      canvas.width = _spaceMarkNaturalW;
      canvas.height = _spaceMarkNaturalH;
      var frame = canvas.closest('.pc-space-map-mark-frame') || canvas.parentElement;
      var frameW = (frame && frame.clientWidth) ? frame.clientWidth : Math.min(window.innerWidth - 24, _spaceMarkNaturalW);
      var narrow = window.matchMedia('(max-width: 767px)').matches
        || !!(document.body && document.body.classList.contains('pc-app-shell'));
      var maxH = narrow
        ? Math.min(Math.round(window.innerHeight * 0.4), 360)
        : Math.min(Math.round(window.innerHeight * 0.65), 640);
      var displayW = Math.min(frameW, _spaceMarkNaturalW);
      var displayH = Math.round(_spaceMarkNaturalH * (displayW / _spaceMarkNaturalW));
      if (displayH > maxH) {
        displayH = maxH;
        displayW = Math.max(1, Math.round(_spaceMarkNaturalW * (displayH / _spaceMarkNaturalH)));
      }
      canvas.style.width = displayW + 'px';
      canvas.style.height = displayH + 'px';
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(_spaceMarkImg, 0, 0, canvas.width, canvas.height);
      drawSpaceMapMarkersOnCanvas(ctx, canvas.width, canvas.height, St.get().spaceMapMarkers);
    }

    if (_spaceMarkImgUrl !== url) {
      _spaceMarkImgUrl = url;
      _spaceMarkImg = new Image();
      _spaceMarkImg.onload = paintFromImg;
      _spaceMarkImg.onerror = function () {
        wrap.classList.add('d-none');
        if (empty) {
          empty.classList.remove('d-none');
          empty.textContent = '地圖載入失敗，請改上傳檔案後再標註';
        }
      };
      _spaceMarkImg.src = url;
    } else {
      paintFromImg();
    }
  }

  function compositeSpaceMapLabeledImage() {
    function drawLabeled(src) {
      return new Promise(function (resolve, reject) {
        var markers = St.get().spaceMapMarkers || {};
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          var ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          drawSpaceMapMarkersOnCanvas(ctx, c.width, c.height, markers);
          try {
            resolve(c.toDataURL('image/jpeg', 0.92));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = function () { reject(new Error('地圖無法讀取')); };
        img.src = src;
      });
    }
    var cached = _spaceMarkImg;
    if (cached && cached.complete && cached.naturalWidth && /^data:/i.test(String(cached.src || ''))) {
      return drawLabeled(cached.src);
    }
    return ensureLayoutImageDataUrl(St.get().layoutReferenceImage).then(drawLabeled);
  }

  function placeSpaceMarkAtClient(clientX, clientY) {
    var canvas = document.getElementById('pcSpaceMapMarkCanvas');
    if (!canvas || !St.get().layoutReferenceImage) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (clientX - rect.left) * scaleX;
    var y = (clientY - rect.top) * scaleY;
    var nx = x / canvas.width;
    var ny = y / canvas.height;
    var letterEl = document.getElementById('pcSpaceMarkLetter');
    if (letterEl && letterEl.value) St.setSpaceMarkActiveLetter(letterEl.value);
    var letter = St.get().spaceMarkActiveLetter || 'A';
    St.setSpaceMapMarker(letter, nx, ny);
    /* 自動跳下一個尚未標的字母（A–Z） */
    var order = spaceMarkAlphabet();
    var m = St.get().spaceMapMarkers || {};
    var next = order.find(function (L) { return !m[L]; });
    if (next) {
      St.setSpaceMarkActiveLetter(next);
      if (letterEl) letterEl.value = next;
    }
    renderSpaceMapMarkStage();
    syncSpaceMarkConfirmUi();
    updateGenerateBtn();
  }

  function bindSpaceMapMarkUi() {
    fillSpaceLookSelects();
    var letterEl = document.getElementById('pcSpaceMarkLetter');
    if (letterEl) {
      letterEl.addEventListener('input', function () {
        var v = String(letterEl.value || '').replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase();
        letterEl.value = v;
        if (v) St.setSpaceMarkActiveLetter(v);
      });
      letterEl.addEventListener('change', function () {
        var v = String(letterEl.value || '').trim().toUpperCase();
        if (/^[A-Z]$/.test(v)) St.setSpaceMarkActiveLetter(v);
        else letterEl.value = St.get().spaceMarkActiveLetter || 'A';
      });
    }
    var clearBtn = document.getElementById('pcSpaceMarkClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        St.clearSpaceMapMarkers();
        if (St.setSpaceLabeledLayoutImage) St.setSpaceLabeledLayoutImage('');
        if (St.setSpaceMapMarkConfirmed) St.setSpaceMapMarkConfirmed(false);
        renderSpaceMapMarkStage();
        syncSpaceMarkConfirmUi();
        updateGenerateBtn();
      });
    }
    var confirmBtn = document.getElementById('pcSpaceMarkConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (!St.hasSpaceLookMarkers || !St.hasSpaceLookMarkers()) {
          showResultError('請先在地圖標齊站點與望向（兩者字母不同）');
          return;
        }
        if ((St.get().spaceLookFrom || 'B') === (St.get().spaceLookTo || 'C')) {
          showResultError('站點與望向不可相同');
          return;
        }
        confirmBtn.disabled = true;
        confirmBtn.textContent = '合成中…';
        compositeSpaceMapLabeledImage().then(function (dataUrl) {
          if (St.setSpaceLabeledLayoutImage) St.setSpaceLabeledLayoutImage(dataUrl);
          if (St.setSpaceMapMarkConfirmed) St.setSpaceMapMarkConfirmed(true);
          syncSpaceMarkConfirmUi();
          updateGenerateBtn();
        }).catch(function (err) {
          if (St.setSpaceMapMarkConfirmed) St.setSpaceMapMarkConfirmed(false);
          syncSpaceMarkConfirmUi();
          showResultError((err && err.message) ? err.message : '標註合成失敗，請改上傳 ISO 檔再標');
        });
      });
    }
    var dlBtn = document.getElementById('pcSpaceMarkDownload');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        if (!St.get().layoutReferenceImage || !Object.keys(St.get().spaceMapMarkers || {}).length) return;
        dlBtn.disabled = true;
        compositeSpaceMapLabeledImage().then(function (dataUrl) {
          var a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'space-map-marked-' + (St.get().spaceLookFrom || 'B') + '-to-' + (St.get().spaceLookTo || 'C') + '.jpg';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }).catch(function (err) {
          showResultError((err && err.message) ? err.message : '下載失敗');
        }).then(function () {
          syncSpaceMarkConfirmUi();
        });
      });
    }
    var fromEl = document.getElementById('pcSpaceLookFrom');
    var toEl = document.getElementById('pcSpaceLookTo');
    if (fromEl) {
      fromEl.addEventListener('change', function () {
        St.setSpaceLookFrom(fromEl.value);
        syncSpaceMarkConfirmUi();
        updateGenerateBtn();
      });
    }
    if (toEl) {
      toEl.addEventListener('change', function () {
        St.setSpaceLookTo(toEl.value);
        syncSpaceMarkConfirmUi();
        updateGenerateBtn();
      });
    }
    var canvas = document.getElementById('pcSpaceMapMarkCanvas');
    if (canvas) {
      canvas.addEventListener('click', function (ev) {
        placeSpaceMarkAtClient(ev.clientX, ev.clientY);
      });
      canvas.addEventListener('touchend', function (ev) {
        if (!ev.changedTouches || !ev.changedTouches[0]) return;
        ev.preventDefault();
        var t = ev.changedTouches[0];
        placeSpaceMarkAtClient(t.clientX, t.clientY);
      }, { passive: false });
    }
  }

  function renderSpaceThumbs() {
    var wrap = document.getElementById('pcSpaceThumbs');
    if (!wrap) return;
    if (!isSpaceMode()) {
      wrap.innerHTML = '';
      wrap.classList.add('d-none');
      return;
    }
    wrap.classList.remove('d-none');
    var fp = St.get().floorPlanImage;
    if (!fp) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<div class="position-relative d-inline-block">' +
      '<img class="pc-thumb" src="' + esc(fp) + '" alt="">' +
      '<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1 pc-remove-floor" style="line-height:1;font-size:10px;">×</button>' +
      '<span class="badge bg-secondary position-absolute bottom-0 start-0 m-1">平面</span></div>';
    var rm = wrap.querySelector('.pc-remove-floor');
    if (rm) {
      rm.addEventListener('click', function () {
        St.setFloorPlanImage('');
        renderSpaceThumbs();
        updateGenerateBtn();
      });
    }
  }

  function renderStyleThumb() {
    var wrap = document.getElementById('pcStyleThumb');
    if (!wrap) return;
    var url = St.get().styleImage;
    if (!url) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<div class="position-relative d-inline-block">' +
      '<img class="pc-thumb" src="' + esc(url) + '" alt="">' +
      '<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1 pc-remove-style" style="line-height:1;font-size:10px;">×</button></div>';
    var rm = wrap.querySelector('.pc-remove-style');
    if (rm) {
      rm.addEventListener('click', function () {
        St.setStyleImage('');
        renderStyleThumb();
        updateGenerateBtn();
      });
    }
  }

  function syncPortraitSceneConflictUi() {
    if (!isPortraitMode()) return;
    var st = St.get();
    var hasRef = !!String(st.sceneReferenceImage || '').trim();
    var hasSceneKey = !!String(st.sceneKey || '').trim();
    var sceneEl = document.getElementById('pcSceneSelect');
    if (sceneEl) {
      if (hasRef) {
        sceneEl.value = '';
        St.setSceneKey('');
        hasSceneKey = false;
      }
      sceneEl.disabled = hasRef;
    }
    var sceneCol = sceneEl && sceneEl.closest('.col-md-6');
    if (sceneCol) sceneCol.classList.toggle('opacity-50', hasRef);
    var scenePickerBtn = document.getElementById('pcScenePickerBtn');
    var scenePickerRow = scenePickerBtn && scenePickerBtn.closest('.pc-app-row');
    if (scenePickerBtn) {
      scenePickerBtn.disabled = hasRef;
      scenePickerBtn.classList.toggle('disabled', hasRef);
    }
    if (scenePickerRow) scenePickerRow.classList.toggle('opacity-50', hasRef);
    var pickSceneRefBtn = document.getElementById('pcPickSceneRefBtn');
    if (pickSceneRefBtn) {
      pickSceneRefBtn.disabled = hasSceneKey;
      pickSceneRefBtn.classList.toggle('disabled', hasSceneKey);
    }
    document.querySelectorAll('label').forEach(function (lbl) {
      if (!lbl.querySelector('#pcSceneRefInput')) return;
      lbl.classList.toggle('disabled', hasSceneKey);
      lbl.classList.toggle('pe-none', hasSceneKey);
      lbl.classList.toggle('opacity-50', hasSceneKey);
    });
    var sceneRefHint = document.getElementById('pcSceneRefHint');
    if (sceneRefHint) {
      sceneRefHint.textContent = hasSceneKey
        ? '已選官方場景，請先清空場景下拉才能上傳場景圖。'
        : (hasRef
          ? '已上傳場景圖，官方場景下拉已關閉。'
          : '上傳或選圖作為人像背景；與官方場景下拉二擇一。');
    }
    if (window.PromoCameraAppShell && typeof window.PromoCameraAppShell.syncAppPickerLabels === 'function') {
      window.PromoCameraAppShell.syncAppPickerLabels();
    }
  }

  function renderSceneRefThumbs() {
    var wrap = document.getElementById('pcSceneRefThumbs');
    if (!wrap) return;
    if (!isPortraitMode()) {
      wrap.innerHTML = '';
      return;
    }
    var url = St.get().sceneReferenceImage;
    if (!url) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<div class="position-relative d-inline-block">' +
      '<img class="pc-thumb" src="' + esc(url) + '" alt="">' +
      '<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1 pc-remove-scene-ref" style="line-height:1;font-size:10px;">×</button>' +
      '<span class="badge bg-secondary position-absolute bottom-0 start-0 m-1">場景</span></div>';
    var rm = wrap.querySelector('.pc-remove-scene-ref');
    if (rm) {
      rm.addEventListener('click', function () {
        St.clearSceneReferenceImage();
        renderSceneRefThumbs();
        syncPortraitSceneConflictUi();
        updateGenerateBtn();
      });
    }
  }

  function renderStagingProductThumbs() {
    var wrap = document.getElementById('pcStagingProductThumbs');
    if (!wrap) return;
    if (!isPortraitMode() && !isSpaceMode()) {
      wrap.innerHTML = '';
      return;
    }
    var url = St.get().stagingProductImage;
    if (!url) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<div class="position-relative d-inline-block">' +
      '<img class="pc-thumb" src="' + esc(url) + '" alt="">' +
      '<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1 pc-remove-staging-product" style="line-height:1;font-size:10px;">×</button>' +
      '<span class="badge bg-secondary position-absolute bottom-0 start-0 m-1">產品</span></div>';
    var rm = wrap.querySelector('.pc-remove-staging-product');
    if (rm) {
      rm.addEventListener('click', function () {
        St.clearStagingProductImage();
        renderStagingProductThumbs();
        updateGenerateBtn();
      });
    }
  }

  function readFileAsDataUrl(file, cb) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    var reader = new FileReader();
    reader.onload = function (ev) { cb(ev.target.result); };
    reader.readAsDataURL(file);
  }

  function renderSelectedThumbs() {
    var wrap = document.getElementById('pcSelectedThumbs');
    if (!wrap) return;
    var imgs = St.get().images;
    if (!imgs.length) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = imgs.map(function (u) {
      return '<div class="position-relative d-inline-block">' +
        '<img class="pc-thumb" src="' + esc(u) + '" alt="">' +
        '<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 py-0 px-1 pc-remove-img" data-url="' + esc(u) + '" style="line-height:1;font-size:10px;">×</button>' +
        '</div>';
    }).join('');
    wrap.querySelectorAll('.pc-remove-img').forEach(function (btn) {
      btn.addEventListener('click', function () {
        St.removeImage(btn.getAttribute('data-url'));
        renderSelectedThumbs();
        updateGenerateBtn();
      });
    });
  }

  function updateCameraBodyImage() {
    var device = document.querySelector('.pc-camera-device');
    var img = document.getElementById('pcCameraBody');
    var lcdWrap = document.querySelector('.pc-camera-lcd-wrap');
    if (!device || !img) return;
    var mode = St.get().lookMode;
    var isFilm = mode === 'film';
    var showOverlay = isFilm || lcdPowered;
    device.classList.toggle('is-film-mode', isFilm);
    device.classList.toggle('is-lcd-on', showOverlay);
    device.classList.toggle('is-lcd-off', !showOverlay);
    if (isFilm) {
      img.src = CAMERA_IMG.film;
    } else {
      img.src = lcdPowered ? CAMERA_IMG.digitalOn : CAMERA_IMG.digitalOff;
    }
    if (lcdWrap) lcdWrap.setAttribute('aria-hidden', showOverlay ? 'false' : 'true');
  }

  function powerOnLcd() {
    if (St.get().lookMode === 'film') return;
    if (lcdPowered) return;
    lcdPowered = true;
    updateCameraBodyImage();
  }

  function pulseCameraDevice(className) {
    powerOnLcd();
    var device = document.querySelector('.pc-camera-device');
    if (!device || !className) return;
    device.classList.remove('is-adjusting-lens', 'is-adjusting-aperture', 'is-adjusting-ev');
    device.classList.add(className);
    if (dialPulseTimer) clearTimeout(dialPulseTimer);
    dialPulseTimer = setTimeout(function () {
      device.classList.remove(className);
    }, 450);
  }

  function flashLcd() {
    if (St.get().lookMode !== 'film') powerOnLcd();
    var lines = document.querySelectorAll('#pcLcd .pc-lcd-line');
    lines.forEach(function (line) {
      line.classList.remove('pc-lcd-flash');
      void line.offsetWidth;
      line.classList.add('pc-lcd-flash');
    });
    if (lcdFlashTimer) clearTimeout(lcdFlashTimer);
    lcdFlashTimer = setTimeout(function () {
      lines.forEach(function (line) { line.classList.remove('pc-lcd-flash'); });
    }, 500);
  }

  function updateLcd() {
    var s = St.getLcdSummary();
    var lookEl = document.querySelector('#pcLcd .pc-lcd-look');
    var lensEl = document.querySelector('#pcLcd .pc-lcd-lens');
    var optEl = document.querySelector('#pcLcd .pc-lcd-optics');
    var bladesEl = document.querySelector('#pcLcd .pc-lcd-blades');
    var prefix = s.lookMode === 'film' ? 'FILM' : 'BODY';
    if (lookEl) lookEl.textContent = prefix + ' · ' + s.look;
    if (lensEl) lensEl.textContent = s.lens;
    var angleLine = document.querySelector('#pcLcd .pc-lcd-angle');
    if (angleLine) angleLine.textContent = s.angle || '—';
    if (optEl) optEl.textContent = s.aperture + ' · ' + s.ev;
    if (bladesEl) bladesEl.textContent = s.blades;
    updateCameraBodyImage();
  }

  function refreshAngleHint() {
    var hint = document.getElementById('pcAngleHint');
    if (!hint) return;
    var list = angleOptionList();
    var angleCat = St.getAngleCategory ? St.getAngleCategory() : 'shooting_angle';
    var key = (St.get().camera || {})[angleCat] || '';
    var hit = list.find(function (r) { return r.key === key; });
    hint.textContent = localizedOptionDescription(hit) || (hit ? localizedOptionName(hit) : t('promoCamera.angleHintDefault', '請點上方按鈕換角度'));
  }

  function renderAngleButtons() {
    var wrap = document.getElementById('pcAngleBtns');
    if (!wrap) return;
    var angleCat = St.getAngleCategory ? St.getAngleCategory() : 'shooting_angle';
    var list = angleOptionList();
    var cur = (St.get().camera || {})[angleCat] || 'keep_reference';
    wrap.innerHTML = list.map(function (r) {
      var active = r.key === cur ? ' active' : '';
      return '<button type="button" class="btn btn-sm btn-outline-secondary pc-angle-btn' + active + '" data-key="' + esc(r.key) + '">' + esc(localizedOptionName(r)) + '</button>';
    }).join('');
    wrap.querySelectorAll('.pc-angle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-key');
        St.setCameraKey(angleCat, k);
        wrap.querySelectorAll('.pc-angle-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-key') === k);
        });
        refreshAngleHint();
        updateLcd();
        flashLcd();
      });
    });
    refreshAngleHint();
  }

  function refreshParamHint(selectEl, hintEl, items) {
    if (!selectEl || !hintEl) return;
    var vk = 'key';
    var v = String(selectEl.value || '').trim();
    var hit = (items || []).find(function (r) { return String(r[vk] || '') === v; });
    hintEl.textContent = localizedOptionDescription(hit);
  }

  function fillLookSelect() {
    var sel = document.getElementById('pcCam_look');
    if (!sel) return;
    var opts = St.get().options;
    if (!opts || !opts.camera_params) return;
    var cat = St.get().lookMode === 'film' ? St.getFilmLookCategory() : St.getDigitalLookCategory();
    var list = opts.camera_params[cat] || [];
    var cur = (St.get().camera || {})[cat] || '';
    if (Promo.fillSelectGrouped) {
      Promo.fillSelectGrouped(sel, list, 'key', 'name', cur);
    } else {
      sel.innerHTML = list.map(function (r) {
        return '<option value="' + esc(r.key) + '"' + (r.key === cur ? ' selected' : '') + '>' + esc(r.name || r.key) + '</option>';
      }).join('');
    }
    refreshParamHint(sel, document.getElementById('pcLookHint'), list);
  }

  function syncLookModeRadios() {
    var mode = St.get().lookMode;
    var digital = document.getElementById('pcLookDigital');
    var film = document.getElementById('pcLookFilm');
    if (digital) digital.checked = mode !== 'film';
    if (film) film.checked = mode === 'film';
  }

  function categoryLabelI18n(cat) {
    var key = 'promoCamera.cat.' + cat;
    var localized = t(key, '');
    if (localized && localized !== key) return localized;
    return St.getCategoryLabel(cat);
  }

  function applyUiLabels() {
    var group = St.getLookGroup();
    var groupLabel = document.getElementById('pcLookGroupLabel');
    if (groupLabel) {
      var groupText = t('promoCamera.lookGroup', '成像來源');
      groupLabel.textContent = groupText;
    }
    var digitalLabel = document.getElementById('pcLookDigitalLabel');
    var filmLabel = document.getElementById('pcLookFilmLabel');
    if (digitalLabel) digitalLabel.textContent = categoryLabelI18n(St.getDigitalLookCategory());
    if (filmLabel) filmLabel.textContent = categoryLabelI18n(St.getFilmLookCategory());
    var lensLabel = document.getElementById('pcLensLabel');
    if (lensLabel) lensLabel.textContent = categoryLabelI18n(St.getLensCategory ? St.getLensCategory() : 'lens');
  }

  function fillCameraSelects() {
    var opts = St.get().options;
    if (!opts || !opts.camera_params) return;
    applyUiLabels();
    syncLookModeRadios();
    fillLookSelect();
    var lensCat = St.getLensCategory ? St.getLensCategory() : 'lens';
    if (St.clampApertureToLens) St.clampApertureToLens();
    St.visibleCategories().forEach(function (cat) {
      if (cat === lensCat) return;
      var el = document.getElementById('pcCam_' + cat);
      if (!el) return;
      var list = (cat === 'aperture' && St.apertureOptionsForCurrentLens)
        ? St.apertureOptionsForCurrentLens()
        : (opts.camera_params[cat] || []);
      var cur = (St.get().camera || {})[cat] || '';
      el.innerHTML = list.map(function (r) {
        return '<option value="' + esc(r.key) + '"' + (r.key === cur ? ' selected' : '') + '>' + esc(r.name || r.key) + '</option>';
      }).join('');
    });
    var lensEl = document.getElementById('pcCam_lens');
    if (lensEl) {
      var lensList = opts.camera_params[lensCat] || [];
      var lensCur = (St.get().camera || {})[lensCat] || '';
      if (Promo.fillSelectGrouped) {
        Promo.fillSelectGrouped(lensEl, lensList, 'key', 'name', lensCur);
      } else {
        lensEl.innerHTML = lensList.map(function (r) {
          return '<option value="' + esc(r.key) + '"' + (r.key === lensCur ? ' selected' : '') + '>' + esc(r.name || r.key) + '</option>';
        }).join('');
      }
      refreshParamHint(lensEl, document.getElementById('pcLensHint'), lensList);
    }
    updateLcd();
  }

  function fillThemeSceneSelects(themesOverride) {
    var opts = St.get().options;
    if (!opts) return;
    var themes = themesOverride || themesForCurrentMode();
    var themeEl = document.getElementById('pcThemeSelect');
    var sceneEl = document.getElementById('pcSceneSelect');
    Promo.fillSelect(themeEl, themes, 'key', 'name', '');
    Promo.fillSelect(sceneEl, opts.scenes || [], 'key', 'name', t('promoCamera.sceneNone', '（不選）'));
    if (themeEl && St.get().themeKey) themeEl.value = St.get().themeKey;
  }

  function updateDimsHint() {
    if (isSpaceMode()) {
      updateSpaceDimsHint();
      return;
    }
    var ratio = document.getElementById('pcRatioSelect');
    var mp = document.getElementById('pcMpSelect');
    var hint = document.getElementById('pcDimsHint');
    if (!ratio || !mp || !hint) return;
    var d = Promo.dimsForRatio(ratio.value, mp.value);
    St.setDims(d.w, d.h, d.ratio, d.mp);
    hint.textContent = d.w + '×' + d.h;
    updatePoints();
  }

  function updatePricingIntro() {
    var el = document.getElementById('pcPricingIntro');
    var opts = St.get().options;
    if (!el || !opts || !Promo.formatPromoCameraPricingHint) return;
    var suffix = apiLang() === 'en' ? '.' : '。';
    var introFallback = apiLang() === 'en'
      ? 'Upload or pick <strong>one</strong> product reference, then tune camera parameters for output quality.'
      : '上傳或從數位資產選擇<strong>一張</strong>產品參考圖，搭配右側參數模擬輸出畫質。';
    el.innerHTML = t('promoCamera.introPrefix', introFallback) +
      Promo.formatPromoCameraPricingHint(opts) + suffix;
  }

  function updatePoints() {
    var st = St.get();
    var el = document.getElementById('pcPointsDisplay');
    if (!el) return;
    var opts = st.options || {};
    var previewOpts = {
      shoot_mode: isSpaceMode() ? 'space' : (isPortraitMode() ? 'portrait' : 'product')
    };
    if (isSpaceMode()) {
      previewOpts.space_output_type = St.get().spaceOutputType || 'layout_plan';
      previewOpts.space_resolution_tier = St.get().spaceResolutionTier || '2k';
      previewOpts.aspect_ratio = St.get().aspectRatio || '1:1';
      var spacePts = spacePointsForTier(opts, previewOpts.space_output_type, previewOpts.space_resolution_tier);
      el.textContent = tpl('promoCamera.pointsEst', '預估 {points} 點', { points: spacePts });
    } else {
      var localEst = Promo.estimatePromoCameraPointsLocal
        ? Promo.estimatePromoCameraPointsLocal(st.width, st.height, opts)
        : Promo.estimatePointsLocal(st.width, st.height, opts.points_standard, opts.points_per_extra_mp);
      var portraitMul = isPortraitMode() ? Math.max(1, parseInt(St.get().outputCount, 10) || 1) : 1;
      el.textContent = tpl('promoCamera.pointsEst', '預估 {points} 點', { points: localEst * portraitMul });
      if (isPortraitMode()) previewOpts.output_count = St.get().outputCount || 1;
    }
    Api.pointsPreview(st.width, st.height, previewOpts).then(function (res) {
      if (res.ok && res.data && res.data.points != null) {
        var note = res.data.is_subscriber_pricing ? t('promoCamera.pointsSubscriber', '（訂閱價）') : '';
        var text = res.data.megapixels && res.data.pricing_mode !== 'space_layout_fixed' && res.data.pricing_mode !== 'space_eye_level_fixed'
          ? tpl('promoCamera.pointsEstMp', '預估 {points} 點（{mp} MP）', { points: res.data.points, mp: res.data.megapixels })
          : tpl('promoCamera.pointsEst', '預估 {points} 點', { points: res.data.points });
        el.textContent = text + note;
      }
    });
  }

  function syncPromptFromDom() {
    var promptEl = document.getElementById('pcPromptInput');
    if (promptEl) St.get().userPrompt = (promptEl.value || '').trim();
  }

  function updateGenerateBtn() {
    var btn = document.getElementById('pcGenerateBtn');
    if (!btn) return;
    syncPromptFromDom();
    /* 全站 .btn-primary { background !important } 會蓋掉 Bootstrap disabled 灰色，
       導致看起來能按、游標卻不變 —— 必須正確切 disabled，並靠下方 CSS 顯示不可點 */
    btn.disabled = !St.canGenerate();
  }

  function onImagesAdded(urls, sourceType, sourceId) {
    var added = [];
    (urls || []).forEach(function (u) {
      if (St.addImage(u, sourceType, sourceId)) added.push(u);
    });
    if (!added.length) return;
    renderSelectedThumbs();
    updateGenerateBtn();
  }

  var assetPickTarget = 'product';

  function openAssetPicker(target) {
    assetPickTarget = target || 'product';
    var modalEl = document.getElementById('pcAssetModal');
    if (!modalEl) return;
    showBootstrapModal(modalEl);
    if (!window.MatchdoDigitalAssetPicker || typeof window.MatchdoDigitalAssetPicker.mount !== 'function') {
      var emptyEl = document.getElementById('pcAssetEmpty');
      var loadingEl = document.getElementById('pcAssetLoading');
      if (loadingEl) loadingEl.classList.add('d-none');
      if (emptyEl) {
        emptyEl.textContent = t('promoCamera.assetPickerFailed', '載入失敗，請稍後再試。');
        emptyEl.classList.remove('d-none');
      }
      return;
    }
    var pickerOpts = {
      tabsEl: document.getElementById('pcAssetPickerTabs'),
      listEl: document.getElementById('pcAssetList'),
      emptyEl: document.getElementById('pcAssetEmpty'),
      loadingEl: document.getElementById('pcAssetLoading'),
      initialTab: assetPickTarget === 'layout' ? 'promo' : 'designs',
      onPick: function (pick) {
        var u = pick && pick.url;
        if (!u) return;
        if (assetPickTarget === 'floor') {
          St.setFloorPlanImage(u);
          renderSpaceThumbs();
          updateGenerateBtn();
          hideBootstrapModal(modalEl);
          return;
        }
        if (assetPickTarget === 'layout') {
          var genId = pick.sourceId || null;
          ensureLayoutImageDataUrl(u).then(function (dataUrl) {
            St.setLayoutReference(dataUrl, genId);
            renderLayoutRefThumbs();
            updateGenerateBtn();
          }).catch(function () {
            St.setLayoutReference(u, genId);
            renderLayoutRefThumbs();
            updateGenerateBtn();
          });
          hideBootstrapModal(modalEl);
          return;
        }
        if (assetPickTarget === 'staging_product') {
          St.setStagingProductImage(u);
          renderStagingProductThumbs();
          updateGenerateBtn();
          hideBootstrapModal(modalEl);
          return;
        }
        if (assetPickTarget === 'scene_ref') {
          St.setSceneReferenceImage(u);
          renderSceneRefThumbs();
          syncPortraitSceneConflictUi();
          updateGenerateBtn();
          hideBootstrapModal(modalEl);
          return;
        }
        var st = pick.sourceType || 'digital_asset';
        var sid = pick.sourceId || null;
        St.clearImages();
        onImagesAdded([u], st === 'custom_product' ? 'custom_product' : 'digital_asset', sid);
        hideBootstrapModal(modalEl);
      }
    };
    if (assetPickTarget === 'layout') {
      pickerOpts.allowedTabs = ['promo'];
      pickerOpts.filterItem = function (item) {
        if (item.asset_kind === 'promo_camera_space_layout') return true;
        return item.shoot_mode === 'space'
          && (!item.space_output_type || item.space_output_type === 'layout_plan');
      };
    }
    window.__pcAssetPickerMount = window.MatchdoDigitalAssetPicker.mount(pickerOpts);
  }

  function bindEvents() {
    updateBackLink();
    bindPreserveSubjectsSelect();
    bindSpaceMapMarkUi();

    var modeProduct = document.getElementById('pcModeProduct');
    var modeSpace = document.getElementById('pcModeSpace');
    var modePortrait = document.getElementById('pcModePortrait');
    if (modeProduct) modeProduct.addEventListener('click', function () { setShootMode('product'); });
    if (modeSpace) modeSpace.addEventListener('click', function () { setShootMode('space'); });
    if (modePortrait) modePortrait.addEventListener('click', function () { setShootMode('portrait'); });

    var spaceUseSel = document.getElementById('pcSpaceUseType');
    if (spaceUseSel) {
      spaceUseSel.addEventListener('change', function () {
        St.setSpaceUseType(spaceUseSel.value);
        updateSpaceOutputPanel();
        updateGenerateBtn();
        updatePoints();
      });
    }

    document.querySelectorAll('input[name="pcSpaceStyleSource"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        St.setSpaceStyleSource(radio.value);
        applyShootModeUi();
        updateGenerateBtn();
      });
    });

    document.querySelectorAll('input[name="pcSpaceOutputType"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        St.setSpaceOutputType(radio.value);
        applyShootModeUi();
        renderMessages();
        updateGenerateBtn();
        updatePoints();
      });
    });

    document.querySelectorAll('input[name="pcSpaceLayoutView"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        St.setSpaceLayoutView(radio.value);
        applySpaceOutputUi();
        updateGenerateBtn();
      });
    });

    var pickFloorBtn = document.getElementById('pcPickFloorPlanBtn');
    if (pickFloorBtn) pickFloorBtn.addEventListener('click', function () { openAssetPicker('floor'); });

    var pickLayoutBtn = document.getElementById('pcPickLayoutBtn');
    if (pickLayoutBtn) pickLayoutBtn.addEventListener('click', function () { openAssetPicker('layout'); });

    var pickStagingBtn = document.getElementById('pcPickStagingProductBtn');
    if (pickStagingBtn) pickStagingBtn.addEventListener('click', function () { openAssetPicker('staging_product'); });
    var pickSceneRefBtn = document.getElementById('pcPickSceneRefBtn');
    if (pickSceneRefBtn) pickSceneRefBtn.addEventListener('click', function () { openAssetPicker('scene_ref'); });
    document.querySelectorAll('.pc-staging-pick-alt').forEach(function (btn) {
      btn.addEventListener('click', function () { openAssetPicker('staging_product'); });
    });
    document.querySelectorAll('.pc-staging-upload-alt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inp = document.getElementById('pcStagingProductInput');
        if (inp) inp.click();
      });
    });

    var stagingInput = document.getElementById('pcStagingProductInput');
    if (stagingInput) {
      stagingInput.addEventListener('change', function (e) {
        var files = e.target.files;
        if (!files || !files[0]) return;
        readFileAsDataUrl(files[0], function (url) {
          St.setStagingProductImage(url);
          renderStagingProductThumbs();
          updateGenerateBtn();
        });
        e.target.value = '';
      });
    }

    var sceneRefInput = document.getElementById('pcSceneRefInput');
    if (sceneRefInput) {
      sceneRefInput.addEventListener('change', function (e) {
        var files = e.target.files;
        if (!files || !files[0]) return;
        readFileAsDataUrl(files[0], function (url) {
          St.setSceneReferenceImage(url);
          renderSceneRefThumbs();
          syncPortraitSceneConflictUi();
          updateGenerateBtn();
        });
        e.target.value = '';
      });
    }

    var floorInput = document.getElementById('pcFloorPlanInput');
    if (floorInput) {
      floorInput.addEventListener('change', function (e) {
        var files = e.target.files;
        if (!files || !files[0]) return;
        readFileAsDataUrl(files[0], function (url) {
          St.setFloorPlanImage(url);
          renderSpaceThumbs();
          updateGenerateBtn();
        });
        e.target.value = '';
      });
    }

    var layoutRefInput = document.getElementById('pcLayoutRefInput');
    if (layoutRefInput) {
      layoutRefInput.addEventListener('change', function (e) {
        var files = e.target.files;
        if (!files || !files[0]) return;
        readFileAsDataUrl(files[0], function (url) {
          St.setLayoutReference(url, null);
          renderLayoutRefThumbs();
          updateGenerateBtn();
        });
        e.target.value = '';
      });
    }

    var styleInput = document.getElementById('pcStyleImageInput');
    if (styleInput) {
      styleInput.addEventListener('change', function (e) {
        var files = e.target.files;
        if (!files || !files[0]) return;
        readFileAsDataUrl(files[0], function (url) {
          St.setStyleImage(url);
          renderStyleThumb();
          updateGenerateBtn();
        });
        e.target.value = '';
      });
    }

    var promptInput = document.getElementById('pcPromptInput');
    if (promptInput) {
      ['input', 'change', 'blur', 'keyup'].forEach(function (evName) {
        promptInput.addEventListener(evName, function () {
          syncPromptFromDom();
          updateGenerateBtn();
        });
      });
    }

    var uploadInput = document.getElementById('pcUploadInput');
    if (uploadInput) {
      uploadInput.addEventListener('change', function (e) {
        var files = e.target.files;
        if (!files || !files.length) return;
        var file = files[0];
        if (!file.type || file.type.indexOf('image/') !== 0) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          St.clearImages();
          onImagesAdded([ev.target.result], 'upload', null);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      });
    }

    var pickAssetBtn = document.getElementById('pcPickAssetBtn');
    if (pickAssetBtn) pickAssetBtn.addEventListener('click', function () { openAssetPicker('product'); });

    ['pcLookDigital', 'pcLookFilm'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        if (!el.checked) return;
        St.setLookMode(el.value);
        lcdPowered = true;
        fillLookSelect();
        updateLcd();
        flashLcd();
      });
    });

    var lookSel = document.getElementById('pcCam_look');
    if (lookSel) {
      lookSel.addEventListener('change', function () {
        var cat = St.get().lookMode === 'film' ? St.getFilmLookCategory() : St.getDigitalLookCategory();
        St.setCameraKey(cat, lookSel.value);
        var list = (St.get().options && St.get().options.camera_params) ? St.get().options.camera_params[cat] || [] : [];
        refreshParamHint(lookSel, document.getElementById('pcLookHint'), list);
        updateLcd();
        flashLcd();
      });
    }

    var lensCat = St.getLensCategory ? St.getLensCategory() : 'lens';
    St.visibleCategories().forEach(function (cat) {
      var el = document.getElementById('pcCam_' + cat);
      if (!el) return;
      el.addEventListener('change', function () {
        St.setCameraKey(cat, el.value);
        if (cat === lensCat) {
          refreshParamHint(el, document.getElementById('pcLensHint'), (St.get().options && St.get().options.camera_params) ? St.get().options.camera_params[lensCat] || [] : []);
          fillCameraSelects();
        }
        updateLcd();
        flashLcd();
        if (cat === lensCat) pulseCameraDevice('is-adjusting-lens');
        if (cat === 'aperture') pulseCameraDevice('is-adjusting-aperture');
        if (cat === 'exposure_ev') pulseCameraDevice('is-adjusting-ev');
      });
    });

    ['pcThemeSelect', 'pcSceneSelect', 'pcRatioSelect', 'pcMpSelect'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        var st = St.get();
        if (id === 'pcThemeSelect') {
          st.themeKey = el.value;
          updateGenerateBtn();
          return;
        }
        if (id === 'pcSceneSelect') {
          St.setSceneKey(el.value);
          renderSceneRefThumbs();
          syncPortraitSceneConflictUi();
        }
        updateDimsHint();
      });
    });

    ['pcSpaceRatioSelect', 'pcSpaceMpSelect'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        updateSpaceDimsHint();
        updateGenerateBtn();
      });
    });

    var portraitCountEl = document.getElementById('pcPortraitCount');
    if (portraitCountEl) {
      portraitCountEl.addEventListener('change', function () {
        St.setOutputCount(portraitCountEl.value);
        updatePortraitBatchUi();
        updateGenerateBtn();
        updatePoints();
      });
    }

    document.getElementById('pcGenerateBtn').addEventListener('click', function () {
      var st = St.get();
      syncPromptFromDom();
      if (!St.canGenerate() || st.generating) return;
      if (isSpaceMode()) {
        if (isSpaceEyeLevel()) {
          if (!St.isSpaceMapMarkConfirmed || !St.isSpaceMapMarkConfirmed()) {
            showResultError('請先按「確定標註」完成地圖選點');
            return;
          }
          if ((St.get().spaceLookFrom || 'B') === (St.get().spaceLookTo || 'C')) {
            showResultError('站點與望向不可相同');
            return;
          }
        } else if (st.spaceStyleSource === 'image') {
          if (!st.styleImage) {
            showResultError('請上傳風格參考圖');
            return;
          }
        } else if (!String(st.userPrompt || '').trim()) {
          showResultError('請填寫風格描述（例：莫蘭迪配色）');
          return;
        }
      }
      st.generating = true;
      updateGenerateBtn();
      clearResultArea();
      showResultLoading();

      function runGenerate(payload) {
        Api.generate(payload).then(function (res) {
          st.generating = false;
          updateGenerateBtn();
          if (!res.ok || !res.data || !res.data.success) {
            showResultError((res.data && res.data.error) ? res.data.error : t('promoCamera.generateFailedShort', '生成失敗'));
            return;
          }
          var d = res.data;
          St.get().lastResult = d;
          var url = d.image_url || d.imageData || '';
          showResultArea(url, d, payload);
        }).catch(function () {
          st.generating = false;
          updateGenerateBtn();
          showResultError(t('promoCamera.generateFailed', '生成失敗，請稍後再試。'));
        });
      }

      var prep = Promise.resolve();
      if (isSpaceMode() && isSpaceEyeLevel()) {
        /* 已用「確定標註」合成過；若缺圖再補一次 */
        if (!St.get().spaceLabeledLayoutImage) {
          prep = compositeSpaceMapLabeledImage().then(function (dataUrl) {
            if (St.setSpaceLabeledLayoutImage) St.setSpaceLabeledLayoutImage(dataUrl);
          });
        }
      }
      prep.then(function () {
        var payload;
        try {
          payload = St.buildGeneratePayload();
        } catch (err) {
          st.generating = false;
          updateGenerateBtn();
          showResultError((err && err.message) ? err.message : t('promoCamera.generateFailedShort', '生成失敗'));
          return;
        }
        runGenerate(payload);
      }).catch(function (err) {
        st.generating = false;
        updateGenerateBtn();
        showResultError((err && err.message) ? err.message : '地圖標註合成失敗，請改上傳 ISO 檔再標');
      });
    });
  }

  function initFromQuery() {
    var p = new URLSearchParams(window.location.search);
    var ref = p.get('ref');
    if (ref) {
      var first = ref.split(',')[0].trim();
      if (first) St.addImage(decodeURIComponent(first), 'upload', null);
      renderSelectedThumbs();
      updateGenerateBtn();
    }
  }

  function refreshFromState() {
    var st = St.get();
    var themeEl = document.getElementById('pcThemeSelect');
    var sceneEl = document.getElementById('pcSceneSelect');
    var ratioEl = document.getElementById('pcRatioSelect');
    var mpEl = document.getElementById('pcMpSelect');
    var promptEl = document.getElementById('pcPromptInput');
    if (!st.options) return;
    fillThemeSceneSelects();
    if (themeEl && st.themeKey) themeEl.value = st.themeKey;
    if (sceneEl) sceneEl.value = st.sceneKey || '';
    syncPortraitSceneConflictUi();
    if (ratioEl && st.aspectRatio) ratioEl.value = st.aspectRatio;
    if (mpEl && st.megapixels) mpEl.value = String(st.megapixels);
    var portraitCountEl = document.getElementById('pcPortraitCount');
    syncOutputCountSelects();
    if (promptEl) promptEl.value = st.userPrompt || '';
    fillCameraSelects();
    renderAngleButtons();
    fillPreserveSubjectsSelect();
    updateDimsHint();
    updateLcd();
    updatePoints();
    document.dispatchEvent(new CustomEvent('matchdo-pc-preset-applied'));
  }

  window.PromoCameraUi = {
    refreshFromState: refreshFromState
  };

  function refreshPromoI18n() {
    if (window.i18n && window.i18n.applyPage) window.i18n.applyPage();
    updatePricingIntro();
    if (St.get().options) {
      fillThemeSceneSelects();
      fillCameraSelects();
      renderAngleButtons();
      fillPreserveSubjectsSelect();
    }
    renderMessages();
    refreshAngleHint();
    updatePoints();
  }

  function boot() {
    if (isEmbedDesign()) {
      var head = document.querySelector('#promo-camera-app .pc-page-head');
      if (head) head.classList.add('d-none');
    }
    var buildTag = document.getElementById('pcBuildTag');
    if (buildTag) buildTag.textContent = window.__MATCHDO_PROMO_CAMERA_BUILD;
    St.get().generating = false;
    updateLcd();
    bindEvents();
    initFromQuery();
    if (window.MatchdoShowOnHomepageControl) {
      window.MatchdoShowOnHomepageControl.init('pcShowOnHomepage', 'pcShowOnHomepageHint');
    }
    renderMessages();
    renderAngleButtons();
    updateGenerateBtn();
    Api.loadOptions(apiLang()).then(function (res) {
      if (!res.ok || !res.data) {
        St.pushMessage('system', t('promoCamera.loadOptionsFailed', '無法載入選項，請確認已登入並執行 docs/add-promo-camera-params.sql'));
        renderMessages();
        return;
      }
      St.setOptions(res.data);
      if (!res.data.camera_defaults_by_mode) {
        St.pushMessage('system', '伺服器版本較舊，無法依產品／空間／人像分別套用參數預設。請重啟本機 Node 或部署含 e3780f3 以後的版本。');
      }
      fillSpaceUseTypes();
      updatePricingIntro();
      refreshSpaceMpSelectLabels();
      syncSpaceResolutionControls();
      fillThemeSceneSelects();
      fillCameraSelects();
      renderAngleButtons();
      fillPreserveSubjectsSelect();
      if (St.get().shootMode === 'space') {
        updateSpaceDimsHint();
      } else {
        updateDimsHint();
      }
      updateLcd();
      if (res.data.camera_migration_hint) {
        St.pushMessage('system', res.data.camera_migration_hint);
        renderMessages();
      }
      document.dispatchEvent(new CustomEvent('matchdo-pc-options-ready'));
      applyShootModeUi();
    });
  }

  document.addEventListener('matchdo-i18n-applied', refreshPromoI18n);

  function startBoot() {
    if (window.i18n && window.i18n.ready) {
      window.i18n.ready.then(boot);
    } else {
      boot();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBoot);
  } else {
    startBoot();
  }
})();
