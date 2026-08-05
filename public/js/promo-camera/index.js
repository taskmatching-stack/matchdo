/**
 * 攝影模擬 — 頁面初始化
 */
(function () {
  'use strict';

        window.__MATCHDO_PROMO_CAMERA_BUILD = 'promo-camera-no-model-names-20260804';

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
    var el = document.getElementById('pcResultArea');
    var panel = getChatPanel();
    if (!el || !url || !Promo.renderPromoResultPanel) return;
    el.classList.remove('d-none');
    if (panel) panel.classList.add('has-result');
    var meta = Object.assign({}, data || {}, {
      aspect_ratio: payload.aspect_ratio,
      theme_key: payload.theme_key,
      scene_key: payload.scene_key,
      user_prompt: payload.user_prompt
    });
    Promo.renderPromoResultPanel(el, data.imageData || url, meta, resultPanelOpts());
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
      wrap.innerHTML = '<div class="pc-msg pc-msg-system">' + t('promoCamera.chatWelcome', '請上傳<strong>一張</strong>產品參考圖，或從數位資產選擇。右側可調相機光學參數（純畫質模擬）。') + '</div>';
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
    St.visibleCategories().forEach(function (cat) {
      if (cat === lensCat) return;
      var el = document.getElementById('pcCam_' + cat);
      if (!el) return;
      var list = opts.camera_params[cat] || [];
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

  function fillThemeSceneSelects() {
    var opts = St.get().options;
    if (!opts) return;
    var themeEl = document.getElementById('pcThemeSelect');
    var sceneEl = document.getElementById('pcSceneSelect');
    Promo.fillSelect(themeEl, opts.themes || [], 'key', 'name', '');
    Promo.fillSelect(sceneEl, opts.scenes || [], 'key', 'name', t('promoCamera.sceneNone', '（不選）'));
    if (themeEl && St.get().themeKey) themeEl.value = St.get().themeKey;
  }

  function updateDimsHint() {
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
    var localEst = Promo.estimatePromoCameraPointsLocal
      ? Promo.estimatePromoCameraPointsLocal(st.width, st.height, opts)
      : Promo.estimatePointsLocal(st.width, st.height, opts.points_standard, opts.points_per_extra_mp);
    el.textContent = tpl('promoCamera.pointsEst', '預估 {points} 點', { points: localEst });
    Api.pointsPreview(st.width, st.height).then(function (res) {
      if (res.ok && res.data && res.data.points != null) {
        var note = res.data.is_subscriber_pricing ? t('promoCamera.pointsSubscriber', '（訂閱價）') : '';
        var text = res.data.megapixels
          ? tpl('promoCamera.pointsEstMp', '預估 {points} 點（{mp} MP）', { points: res.data.points, mp: res.data.megapixels })
          : tpl('promoCamera.pointsEst', '預估 {points} 點', { points: res.data.points });
        el.textContent = text + note;
      }
    });
  }

  function updateGenerateBtn() {
    var btn = document.getElementById('pcGenerateBtn');
    if (!btn) return;
    btn.disabled = St.get().generating || !St.get().images.length;
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

  function openAssetPicker() {
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
    window.__pcAssetPickerMount = window.MatchdoDigitalAssetPicker.mount({
      tabsEl: document.getElementById('pcAssetPickerTabs'),
      listEl: document.getElementById('pcAssetList'),
      emptyEl: document.getElementById('pcAssetEmpty'),
      loadingEl: document.getElementById('pcAssetLoading'),
      onPick: function (pick) {
        var u = pick && pick.url;
        if (!u) return;
        var st = pick.sourceType || 'digital_asset';
        var sid = pick.sourceId || null;
        St.clearImages();
        onImagesAdded([u], st === 'custom_product' ? 'custom_product' : 'digital_asset', sid);
        hideBootstrapModal(modalEl);
      }
    });
  }

  function bindEvents() {
    updateBackLink();
    bindPreserveSubjectsSelect();

    document.getElementById('pcUploadInput').addEventListener('change', function (e) {
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

    document.getElementById('pcPickAssetBtn').addEventListener('click', openAssetPicker);

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
        if (id === 'pcThemeSelect') st.themeKey = el.value;
        if (id === 'pcSceneSelect') st.sceneKey = el.value;
        updateDimsHint();
      });
    });

    document.getElementById('pcGenerateBtn').addEventListener('click', function () {
      var st = St.get();
      if (!st.images.length || st.generating) return;
      st.userPrompt = (document.getElementById('pcPromptInput').value || '').trim();
      st.generating = true;
      updateGenerateBtn();
      clearResultArea();
      showResultLoading();

      var payload = St.buildGeneratePayload();
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
    if (ratioEl && st.aspectRatio) ratioEl.value = st.aspectRatio;
    if (mpEl && st.megapixels) mpEl.value = String(st.megapixels);
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
    updateLcd();
    bindEvents();
    initFromQuery();
    if (window.MatchdoShowOnHomepageControl) {
      window.MatchdoShowOnHomepageControl.init('pcShowOnHomepage', 'pcShowOnHomepageHint');
    }
    renderMessages();
    renderAngleButtons();
    Api.loadOptions(apiLang()).then(function (res) {
      if (!res.ok || !res.data) {
        St.pushMessage('system', t('promoCamera.loadOptionsFailed', '無法載入選項，請確認已登入並執行 docs/add-promo-camera-params.sql'));
        renderMessages();
        return;
      }
      St.setOptions(res.data);
      updatePricingIntro();
      fillThemeSceneSelects();
      fillCameraSelects();
      renderAngleButtons();
      fillPreserveSubjectsSelect();
      updateDimsHint();
      updateLcd();
      if (res.data.camera_migration_hint) {
        St.pushMessage('system', res.data.camera_migration_hint);
        renderMessages();
      }
      document.dispatchEvent(new CustomEvent('matchdo-pc-options-ready'));
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
