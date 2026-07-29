/**
 * 攝影模擬 — 頁面初始化
 */
(function () {
  'use strict';

  window.__MATCHDO_PROMO_CAMERA_BUILD = 'promo-camera-20260729l';

  var ANGLE_FALLBACK = [
    { key: 'keep_reference', name: '維持參考角度', description: '不強制改角度，以參考圖構圖為主。' },
    { key: 'hero_34', name: '45° 英雄角', description: '同一產品改為 45° 英雄角，主視覺面清楚。' },
    { key: 'front', name: '正視', description: '同一產品改為正面對鏡頭。' },
    { key: 'side_profile', name: '側面', description: '同一產品改為側面輪廓。' },
    { key: 'top_down', name: '俯拍', description: '同一產品改為俯拍／平拍視角。' },
    { key: 'low_angle', name: '低角度', description: '同一產品改為低角度仰拍。' },
    { key: 'back_34', name: '後 3/4', description: '同一產品改為後 3/4 角度。' }
  ];

  function angleOptionList() {
    var angleCat = St.getAngleCategory ? St.getAngleCategory() : 'shooting_angle';
    var fromApi = (St.get().options && St.get().options.camera_params) ? St.get().options.camera_params[angleCat] || [] : [];
    if (fromApi.length) return fromApi;
    return ANGLE_FALLBACK;
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

  function backHref() {
    var p = new URLSearchParams(window.location.search);
    return p.get('back') === 'vendor'
      ? '/client/manufacturer-materials.html'
      : '/custom-product.html?tab=promo-image';
  }

  function showBootstrapModal(el) {
    if (!el || typeof bootstrap === 'undefined') return;
    if (!assetModal) assetModal = new bootstrap.Modal(el);
    assetModal.show();
  }

  function hideBootstrapModal(el) {
    if (assetModal) assetModal.hide();
  }

  function renderMessages() {
    var wrap = document.getElementById('pcChatMessages');
    if (!wrap) return;
    var msgs = St.cloneMessages();
    if (!msgs.length) {
      wrap.innerHTML = '<div class="pc-msg pc-msg-system">請上傳<strong>一張</strong>產品參考圖，或從數位資產選擇。右側可調相機光學參數（純畫質模擬）。</div>';
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
      if (m.extra && m.extra.resultUrl) {
        html += '<img class="pc-result-img" src="' + esc(m.extra.resultUrl) + '" alt="生成結果">';
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

  function pulseCameraDevice(className) {
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
    var prefix = s.lookMode === 'film' ? 'FILM' : 'BODY';
    if (lookEl) lookEl.textContent = prefix + ' · ' + s.look;
    if (lensEl) lensEl.textContent = s.lens;
    var angleLine = document.querySelector('#pcLcd .pc-lcd-angle');
    if (angleLine) angleLine.textContent = s.angle || '—';
    if (optEl) optEl.textContent = s.aperture + ' · ' + s.ev + ' · ' + s.blades;

    var ring = document.getElementById('pcLensRing');
    if (ring) {
      var lensCat = St.getLensCategory ? St.getLensCategory() : 'lens';
      var lensList = (St.get().options && St.get().options.camera_params) ? St.get().options.camera_params[lensCat] || [] : [];
      var lensKey = (St.get().camera || {})[lensCat] || '';
      var lensIdx = lensList.findIndex(function (r) { return r.key === lensKey; });
      var rot = lensIdx >= 0 ? lensIdx * 10 : 0;
      ring.style.transform = 'rotate(' + rot + 'deg)';
    }
  }

  function refreshAngleHint() {
    var hint = document.getElementById('pcAngleHint');
    if (!hint) return;
    var list = angleOptionList();
    var angleCat = St.getAngleCategory ? St.getAngleCategory() : 'shooting_angle';
    var key = (St.get().camera || {})[angleCat] || '';
    var hit = list.find(function (r) { return r.key === key; });
    hint.textContent = (hit && hit.description) ? hit.description : (hit ? (hit.name || '') : '請點上方按鈕換角度');
  }

  function renderAngleButtons() {
    var wrap = document.getElementById('pcAngleBtns');
    if (!wrap) return;
    var angleCat = St.getAngleCategory ? St.getAngleCategory() : 'shooting_angle';
    var list = angleOptionList();
    var cur = (St.get().camera || {})[angleCat] || 'keep_reference';
    wrap.innerHTML = list.map(function (r) {
      var active = r.key === cur ? ' active' : '';
      return '<button type="button" class="btn btn-sm btn-outline-secondary pc-angle-btn' + active + '" data-key="' + esc(r.key) + '">' + esc(r.name || r.key) + '</button>';
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
    hintEl.textContent = (hit && hit.description) ? String(hit.description) : '';
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

  function applyUiLabels() {
    var group = St.getLookGroup();
    var groupLabel = document.getElementById('pcLookGroupLabel');
    if (groupLabel && group && group.label) groupLabel.textContent = group.label;
    var digitalLabel = document.getElementById('pcLookDigitalLabel');
    var filmLabel = document.getElementById('pcLookFilmLabel');
    if (digitalLabel) digitalLabel.textContent = St.getCategoryLabel(St.getDigitalLookCategory());
    if (filmLabel) filmLabel.textContent = St.getCategoryLabel(St.getFilmLookCategory());
    var lensLabel = document.getElementById('pcLensLabel');
    if (lensLabel) lensLabel.textContent = St.getCategoryLabel(St.getLensCategory ? St.getLensCategory() : 'lens');
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
    Promo.fillSelect(sceneEl, opts.scenes || [], 'key', 'name', '（不選）');
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
    el.innerHTML = '上傳或從數位資產選擇<strong>一張</strong>產品參考圖，搭配右側參數模擬 FLUX 畫質。' +
      Promo.formatPromoCameraPricingHint(opts) + '。';
  }

  function updatePoints() {
    var st = St.get();
    var el = document.getElementById('pcPointsDisplay');
    if (!el) return;
    var opts = st.options || {};
    var localEst = Promo.estimatePromoCameraPointsLocal
      ? Promo.estimatePromoCameraPointsLocal(st.width, st.height, opts)
      : Promo.estimatePointsLocal(st.width, st.height, opts.points_standard, opts.points_per_extra_mp);
    el.textContent = '預估 ' + localEst + ' 點';
    Api.pointsPreview(st.width, st.height).then(function (res) {
      if (res.ok && res.data && res.data.points != null) {
        var note = res.data.is_subscriber_pricing ? '（訂閱價）' : '';
        var mpNote = res.data.megapixels ? '（' + res.data.megapixels + ' MP）' : '';
        el.textContent = '預估 ' + res.data.points + ' 點' + mpNote + note;
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
    St.pushMessage('user', '已選產品參考圖', { thumbs: added });
    renderMessages();
    updateGenerateBtn();
  }

  function openAssetPicker() {
    var modalEl = document.getElementById('pcAssetModal');
    var listEl = document.getElementById('pcAssetList');
    var emptyEl = document.getElementById('pcAssetEmpty');
    var loadingEl = document.getElementById('pcAssetLoading');
    if (!modalEl || !listEl) return;
    listEl.innerHTML = '';
    emptyEl.classList.add('d-none');
    loadingEl.classList.remove('d-none');
    showBootstrapModal(modalEl);
    Api.loadDigitalAssets(40, 0).then(function (res) {
      loadingEl.classList.add('d-none');
      var products = (res.data && res.data.products) ? res.data.products : [];
      if (!products.length) {
        emptyEl.classList.remove('d-none');
        emptyEl.textContent = '尚無數位資產，請先上傳或從本機選圖。';
        return;
      }
      emptyEl.classList.add('d-none');
      products.forEach(function (p) {
        var url = (p.ai_generated_image_url || p.image_url || '').trim();
        if (!url) return;
        var title = (p.title || p.generation_prompt || '').toString().substring(0, 40);
        var col = document.createElement('div');
        col.className = 'col-6 col-md-4';
        col.innerHTML = '<div class="card border h-100 pc-asset-pick" style="cursor:pointer" data-url="' + esc(url) + '" data-pid="' + esc(p.id || '') + '">' +
          '<img class="card-img-top" src="' + esc(url) + '" alt="" style="height:100px;object-fit:cover">' +
          '<div class="card-body py-1"><p class="small text-muted mb-0 text-truncate">' + esc(title || '未命名') + '</p></div></div>';
        listEl.appendChild(col);
      });
      listEl.querySelectorAll('.pc-asset-pick').forEach(function (card) {
        card.addEventListener('click', function () {
          var u = card.getAttribute('data-url');
          var pid = card.getAttribute('data-pid');
          St.clearImages();
          onImagesAdded([u], pid ? 'custom_product' : 'digital_asset', pid || null);
          hideBootstrapModal(modalEl);
        });
      });
    }).catch(function () {
      loadingEl.classList.add('d-none');
      emptyEl.classList.remove('d-none');
      emptyEl.textContent = '載入失敗，請稍後再試。';
    });
  }

  function bindEvents() {
    document.getElementById('pcBackLink').setAttribute('href', backHref());

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
      var brief = st.userPrompt ? ('「' + st.userPrompt + '」') : '（未填描述）';
      St.pushMessage('user', '生成請求' + (st.userPrompt ? '：' + brief : ''));
      St.pushMessage('assistant', '生成中，請稍候…');
      renderMessages();

      var payload = St.buildGeneratePayload();
      Api.generate(payload).then(function (res) {
        st.generating = false;
        updateGenerateBtn();
        St.get().messages.pop();
        if (!res.ok || !res.data || !res.data.success) {
          St.pushMessage('assistant', res.data && res.data.error ? res.data.error : '生成失敗');
          renderMessages();
          return;
        }
        var d = res.data;
        St.get().lastResult = d;
        var url = d.image_url || d.imageData || '';
        St.pushMessage('assistant', '生成完成。已存入「我的數位資產 → 情境圖」。', { resultUrl: url });
        renderMessages();
        var actions = document.createElement('div');
        actions.className = 'mt-2';
        var resultWrap = document.getElementById('pcChatMessages');
        if (resultWrap && url) {
          Promo.appendPromoResultActions(actions, {
            id: d.id,
            image_url: d.image_url,
            width: d.width,
            height: d.height,
            aspect_ratio: payload.aspect_ratio,
            theme_key: payload.theme_key,
            scene_key: payload.scene_key,
            user_prompt: payload.user_prompt
          }, d.imageData, {
            labels: { download: '下載', save: '儲存到數位資產庫', saved: '已儲存', viewLibrary: '查看情境圖' },
            libraryHref: '/client/my-custom-products.html?tab=promo'
          });
          resultWrap.lastElementChild && resultWrap.lastElementChild.appendChild(actions);
        }
      }).catch(function () {
        st.generating = false;
        updateGenerateBtn();
        St.get().messages.pop();
        St.pushMessage('assistant', '生成失敗，請稍後再試。');
        renderMessages();
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

  function boot() {
    document.getElementById('pcBuildTag').textContent = window.__MATCHDO_PROMO_CAMERA_BUILD;
    bindEvents();
    initFromQuery();
    renderMessages();
    renderAngleButtons();
    Api.loadOptions((window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh').then(function (res) {
      if (!res.ok || !res.data) {
        St.pushMessage('system', '無法載入選項，請確認已登入並執行 docs/add-promo-camera-params.sql');
        renderMessages();
        return;
      }
      St.setOptions(res.data);
      updatePricingIntro();
      fillThemeSceneSelects();
      fillCameraSelects();
      renderAngleButtons();
      updateDimsHint();
      if (res.data.camera_migration_hint) {
        St.pushMessage('system', res.data.camera_migration_hint);
        renderMessages();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
