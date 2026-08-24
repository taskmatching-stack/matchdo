/**
 * 攝影模擬 — 狀態（無 DOM）
 */
(function (global) {
  'use strict';

  var MAX_IMAGES = 1;

  var DEFAULT_UI = {
    category_labels: {
      camera_brand: '品牌色彩',
      film_simulation: '底片模擬',
      aperture: '光圈',
      exposure_ev: 'EV 曝光',
      lens: '鏡頭',
      aperture_blades: '光圈葉片'
    },
    exclusive_groups: [
      { id: 'look', label: '成像來源', categories: ['camera_brand', 'film_simulation'], default_category: 'camera_brand' }
    ],
    ui_hidden_categories: ['focal_length', 'lens_type'],
    lens_primary_category: 'lens',
    groupable_categories: ['film_simulation', 'lens'],
    group_meta_key: 'group',
    angle_button_category: 'shooting_angle'
  };

  var state = {
    options: null,
    images: [],
    sourceType: 'upload',
    sourceId: null,
    shootMode: 'product',
    spaceOutputType: 'layout_plan',
    spaceLayoutView: 'iso_45',
    spaceStyleSource: 'prompt',
    spaceUseType: 'residential',
    spaceResolutionTier: '2k',
    spaceZoneIntentKeys: [],
    floorPlanImage: '',
    layoutReferenceImage: '',
    planningSimFurnitureImage: '',
    layoutGenerationId: null,
    spaceMapMarkers: {},
    spaceMarkActiveLetter: 'A',
    spaceLookFrom: 'B',
    spaceLookTo: 'C',
    spaceLabeledLayoutImage: '',
    spaceMapMarkConfirmed: false,
    styleImage: '',
    stagingProductImage: '',
    sceneReferenceImage: '',
    themeKey: '',
    sceneKey: '',
    portraitRenderMode: 'clear',
    portraitPeopleCount: 1,
    portraitSubjectGender: 'female',
    aspectRatio: '1:1',
    megapixels: 1,
    width: 1024,
    height: 1024,
    userPrompt: '',
    outputCount: 1,
    camera: {},
    lookMode: 'digital',
    messages: [],
    generating: false,
    lastResult: null
  };

  function getUiConfig() {
    return (state.options && state.options.camera_ui) || DEFAULT_UI;
  }

  function getLookGroup() {
    var ui = getUiConfig();
    return (ui.exclusive_groups || [])[0] || null;
  }

  function getDigitalLookCategory() {
    var g = getLookGroup();
    return (g && g.categories && g.categories[0]) || 'camera_brand';
  }

  function getFilmLookCategory() {
    var g = getLookGroup();
    return (g && g.categories && g.categories[1]) || 'film_simulation';
  }

  function getCategoryLabel(cat) {
    var labels = getUiConfig().category_labels || {};
    return labels[cat] || cat;
  }

  function getLensCategory() {
    return getUiConfig().lens_primary_category || 'lens';
  }

  function getAngleCategory() {
    return getUiConfig().angle_button_category || 'shooting_angle';
  }

  function getSubjectPreservationCategory() {
    return 'subject_preservation';
  }

  function visibleCategories() {
    var hidden = getUiConfig().ui_hidden_categories || ['focal_length', 'lens_type'];
    var hiddenSet = {};
    hidden.forEach(function (c) { hiddenSet[c] = true; });
    var lensCat = getLensCategory();
    return [lensCat, 'aperture', 'exposure_ev', 'aperture_blades'].filter(function (c) {
      return !hiddenSet[c];
    });
  }

  function cloneMessages() {
    return state.messages.slice();
  }

  function inferLookModeFromCamera() {
    var digitalCat = getDigitalLookCategory();
    var filmCat = getFilmLookCategory();
    var cam = state.camera || {};
    if (cam[filmCat] && !cam[digitalCat]) return 'film';
    return 'digital';
  }

  function getCameraDefaultsForMode(mode) {
    var m = mode || state.shootMode || 'product';
    var byMode = (state.options && state.options.camera_defaults_by_mode) || {};
    return byMode[m] || (state.options && state.options.camera_defaults) || {};
  }

  function applyLookModeDefaults() {
    var digitalCat = getDigitalLookCategory();
    var filmCat = getFilmLookCategory();
    var defs = getCameraDefaultsForMode();
    var params = (state.options && state.options.camera_params) || {};
    var lensCat = getLensCategory();
    if (state.lookMode === 'film') {
      delete state.camera[digitalCat];
      if (!state.camera[filmCat]) {
        state.camera[filmCat] = defs[filmCat] || ((params[filmCat] || [])[0] && (params[filmCat][0].key)) || '';
      }
    } else {
      delete state.camera[filmCat];
      if (!state.camera[digitalCat]) {
        state.camera[digitalCat] = defs[digitalCat] || ((params[digitalCat] || [])[0] && (params[digitalCat][0].key)) || '';
      }
    }
    if (!state.camera[lensCat]) {
      state.camera[lensCat] = defs[lensCat] || ((params[lensCat] || [])[0] && (params[lensCat][0].key)) || '';
    }
    var angleCat = getAngleCategory();
    if (!state.camera[angleCat]) {
      state.camera[angleCat] = defs[angleCat] || 'keep_reference';
    }
    var subjectCat = getSubjectPreservationCategory();
    if (!state.camera[subjectCat]) {
      state.camera[subjectCat] = defs[subjectCat] || 'keep';
    }
    delete state.camera.focal_length;
    delete state.camera.lens_type;
  }

  function applyShootModeCameraDefaults() {
    var defs = getCameraDefaultsForMode();
    if (!Object.keys(defs).length && !(state.options && state.options.camera_defaults_by_mode)) return;
    state.camera = Object.assign({}, defs);
    state.lookMode = inferLookModeFromCamera();
    applyLookModeDefaults();
    clampApertureToLens();
  }

  function setOptions(data) {
    state.options = data || null;
    if (data && (data.camera_defaults || data.camera_defaults_by_mode)) {
      state.camera = Object.assign({}, getCameraDefaultsForMode());
    }
    state.lookMode = inferLookModeFromCamera();
    applyLookModeDefaults();
    clampApertureToLens();
    if (data) {
      var themes = getThemesForMode(state.shootMode);
      if (themes.length && !state.themeKey) {
        state.themeKey = themes[0].key || '';
      }
      var defMode = String(data.promo_portrait_default_render_mode || '').toLowerCase();
      if (defMode === 'mood' || defMode === 'clear') {
        state.portraitRenderMode = defMode;
      }
    }
  }

  function setPortraitRenderMode(mode) {
    var m = String(mode || '').toLowerCase();
    state.portraitRenderMode = (m === 'mood') ? 'mood' : 'clear';
  }

  function setPortraitPeopleCount(n) {
    var v = parseInt(n, 10);
    state.portraitPeopleCount = (v >= 1 && v <= 4) ? v : 1;
  }

  function setPortraitSubjectGender(g) {
    var s = String(g || '').toLowerCase();
    state.portraitSubjectGender = (s === 'male') ? 'male' : 'female';
  }

  function addImage(url, sourceType, sourceId) {
    if (!url) return false;
    if (state.images.length >= MAX_IMAGES) {
      state.images = [];
    }
    if (state.images.indexOf(url) >= 0) return false;
    state.images.push(url);
    if (sourceType) state.sourceType = sourceType;
    if (sourceId) state.sourceId = sourceId;
    return true;
  }

  function removeImage(url) {
    var i = state.images.indexOf(url);
    if (i < 0) return;
    state.images.splice(i, 1);
    if (!state.images.length) {
      state.sourceType = 'upload';
      state.sourceId = null;
    }
  }

  function clearImages() {
    state.images = [];
    state.sourceType = 'upload';
    state.sourceId = null;
  }

  function setLookMode(mode) {
    state.lookMode = mode === 'film' ? 'film' : 'digital';
    applyLookModeDefaults();
  }

  function setCameraKey(category, key) {
    if (!category) return;
    state.camera[category] = key || '';
    if (category === getDigitalLookCategory()) state.lookMode = 'digital';
    if (category === getFilmLookCategory()) state.lookMode = 'film';
    applyLookModeDefaults();
    if (category === getLensCategory()) clampApertureToLens();
  }

  function getCompatibleApertureKeys(lensKey) {
    var lensCat = getLensCategory();
    var list = (state.options && state.options.camera_params && state.options.camera_params[lensCat]) || [];
    var lens = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].key === lensKey) { lens = list[i]; break; }
    }
    var meta = lens && lens.meta && typeof lens.meta === 'object' ? lens.meta : null;
    if (!meta || !Array.isArray(meta.compatible_apertures)) return null;
    var keys = meta.compatible_apertures.map(function (k) { return String(k || '').trim(); }).filter(Boolean);
    return keys.length ? keys : null;
  }

  function apertureOptionsForCurrentLens() {
    var all = (state.options && state.options.camera_params && state.options.camera_params.aperture) || [];
    var lensCat = getLensCategory();
    var lensKey = (state.camera || {})[lensCat] || '';
    var allowed = getCompatibleApertureKeys(lensKey);
    if (!allowed) return all.slice();
    var set = {};
    allowed.forEach(function (k) { set[k] = true; });
    var filtered = all.filter(function (r) { return r && set[r.key]; });
    return filtered.length ? filtered : all.slice();
  }

  function clampApertureToLens() {
    var filtered = apertureOptionsForCurrentLens();
    if (!filtered.length) return;
    var cur = (state.camera || {}).aperture || '';
    if (filtered.some(function (r) { return r.key === cur; })) return;
    var defs = getCameraDefaultsForMode();
    var prefer = defs.aperture;
    if (prefer && filtered.some(function (r) { return r.key === prefer; })) {
      state.camera.aperture = prefer;
    } else {
      state.camera.aperture = filtered[0].key;
    }
  }

  function setDims(w, h, ratio, mp) {
    /* 空間模式禁止被產品 1024 覆寫 */
    if (state.shootMode === 'space') {
      applySpaceDimensions(ratio || state.aspectRatio || '1:1', state.spaceResolutionTier || '2k');
      return;
    }
    state.width = w;
    state.height = h;
    if (ratio) state.aspectRatio = ratio;
    if (mp) state.megapixels = mp;
  }

  function optionKeyExists(cat, key) {
    if (!key || !state.options || !state.options.camera_params) return false;
    var list = state.options.camera_params[cat] || [];
    return list.some(function (r) { return r.key === key; });
  }

  function getThemesForMode(mode) {
    if (!state.options) return [];
    var m = mode || state.shootMode || 'product';
    if (m === 'portrait') {
      return state.options.themes_portrait || state.options.themes || [];
    }
    if (m === 'product') {
      return state.options.themes_product || state.options.themes || [];
    }
    return state.options.themes || [];
  }

  function themeKeyExists(key) {
    if (!key) return false;
    return getThemesForMode(state.shootMode).some(function (r) { return r.key === key; });
  }

  function sceneKeyExists(key) {
    if (!key) return true;
    if (!state.options || !state.options.scenes) return false;
    return state.options.scenes.some(function (r) { return r.key === key; });
  }

  function toPresetSnapshot(name) {
    return {
      v: 1,
      name: String(name || '').trim(),
      themeKey: state.themeKey || '',
      sceneKey: state.sceneKey || '',
      aspectRatio: state.aspectRatio || '1:1',
      megapixels: state.megapixels || 1,
      lookMode: state.lookMode === 'film' ? 'film' : 'digital',
      camera: JSON.parse(JSON.stringify(state.camera || {})),
      userPrompt: state.userPrompt || ''
    };
  }

  function applyPreset(preset) {
    if (!preset || preset.v !== 1 || !state.options) return false;
    if (preset.themeKey && themeKeyExists(preset.themeKey)) state.themeKey = preset.themeKey;
    else if (preset.themeKey === '') state.themeKey = '';
    if (sceneKeyExists(preset.sceneKey)) setSceneKey(preset.sceneKey || '');
    state.aspectRatio = preset.aspectRatio || state.aspectRatio || '1:1';
    state.megapixels = parseInt(preset.megapixels, 10) || 1;
    state.userPrompt = String(preset.userPrompt || '');
    state.lookMode = preset.lookMode === 'film' ? 'film' : 'digital';
    var incoming = preset.camera && typeof preset.camera === 'object' ? preset.camera : {};
    Object.keys(incoming).forEach(function (cat) {
      if (cat.indexOf('_') === 0) return;
      if (optionKeyExists(cat, incoming[cat])) state.camera[cat] = incoming[cat];
    });
    applyLookModeDefaults();
    clampApertureToLens();
    return true;
  }

  function pushMessage(role, text, extra) {
    state.messages.push({
      role: role,
      text: text || '',
      extra: extra || null,
      at: Date.now()
    });
  }

  function setShootMode(mode) {
    var m = String(mode || 'product').trim().toLowerCase();
    if (m === 'space') state.shootMode = 'space';
    else if (m === 'portrait') state.shootMode = 'portrait';
    else state.shootMode = 'product';

    if (state.shootMode === 'space' || state.shootMode === 'portrait') {
      applySpaceDimensions(state.aspectRatio || '1:1', state.spaceResolutionTier || '2k');
    } else if (state.width >= 2048 && state.height >= 2048 && state.megapixels >= 4) {
      state.width = 1024;
      state.height = 1024;
      state.aspectRatio = '1:1';
      state.megapixels = 1;
    }

    var themes = getThemesForMode(state.shootMode);
    if (state.shootMode !== 'space' && themes.length) {
      if (!themes.some(function (t) { return t.key === state.themeKey; })) {
        state.themeKey = themes[0].key || '';
      }
    }
    applyShootModeCameraDefaults();
  }

  function setSpaceStyleSource(src) {
    state.spaceStyleSource = src === 'image' ? 'image' : 'prompt';
    if (state.spaceStyleSource === 'prompt') {
      state.styleImage = '';
    }
  }

  function setSpaceUseType(key) {
    state.spaceUseType = key ? String(key) : 'residential';
    state.spaceZoneIntentKeys = [];
  }

  function getSpaceZoneIntentsForUseType(useType) {
    var opts = state.options || {};
    var byType = opts.zone_intents_by_type || {};
    var key = useType || state.spaceUseType || 'residential';
    if (byType[key] && byType[key].length) return byType[key];
    if (opts.zone_intents && opts.zone_intents.length) return opts.zone_intents;
    return [];
  }

  function setSpaceZoneIntentKeys(keys) {
    var list = Array.isArray(keys) ? keys : [];
    state.spaceZoneIntentKeys = list.map(function (k) { return String(k || '').trim(); }).filter(Boolean);
  }

  function toggleSpaceZoneIntent(key, checked) {
    var k = String(key || '').trim();
    if (!k) return;
    var cur = (state.spaceZoneIntentKeys || []).slice();
    var idx = cur.indexOf(k);
    if (checked && idx < 0) cur.push(k);
    if (!checked && idx >= 0) cur.splice(idx, 1);
    state.spaceZoneIntentKeys = cur;
  }

  function normalizeSpaceResolutionTier(raw) {
    var t = String(raw || '2k').trim().toLowerCase();
    if (t === '4k') return '4k';
    if (t === '1k') return '1k';
    return '2k';
  }

  function applySpaceDimensions(ratio, tier) {
    var Promo = global.MatchdoPromoImage;
    if (!Promo || typeof Promo.dimsForSpaceRatio !== 'function') {
      var t = normalizeSpaceResolutionTier(tier);
      var edge = t === '4k' ? 4096 : (t === '1k' ? 1024 : 2048);
      state.width = edge;
      state.height = edge;
      state.aspectRatio = ratio || '1:1';
      state.megapixels = Promo && Promo.megapixelsFromDims
        ? Promo.megapixelsFromDims(edge, edge)
        : Math.ceil((edge * edge) / (1024 * 1024));
      state.spaceResolutionTier = t;
      return;
    }
    var d = Promo.dimsForSpaceRatio(ratio || state.aspectRatio || '1:1', tier || state.spaceResolutionTier);
    state.width = d.w;
    state.height = d.h;
    state.aspectRatio = d.ratio;
    state.megapixels = d.mp;
    state.spaceResolutionTier = d.tier || '2k';
  }

  function setSpaceResolutionTier(tier) {
    state.spaceResolutionTier = normalizeSpaceResolutionTier(tier);
    applySpaceDimensions(state.aspectRatio, state.spaceResolutionTier);
  }

  function setSpaceMegapixels(mp) {
    var Promo = global.MatchdoPromoImage;
    var tier = Promo && Promo.spaceTierFromMegapixels
      ? Promo.spaceTierFromMegapixels(mp)
      : (parseInt(mp, 10) >= 16 ? '4k' : (parseInt(mp, 10) <= 1 ? '1k' : '2k'));
    setSpaceResolutionTier(tier);
  }

  function setSpaceAspectRatio(ratio) {
    state.aspectRatio = ratio || '1:1';
    applySpaceDimensions(state.aspectRatio, state.spaceResolutionTier);
  }

  function setFloorPlanImage(url) {
    state.floorPlanImage = url || '';
  }

  function setPlanningSimFurnitureImage(url) {
    state.planningSimFurnitureImage = url || '';
  }

  function setLayoutReference(url, generationId) {
    state.layoutReferenceImage = url || '';
    state.layoutGenerationId = generationId ? String(generationId) : null;
    state.spaceMapMarkers = {};
    state.spaceLabeledLayoutImage = '';
    state.spaceMapMarkConfirmed = false;
  }

  function clearLayoutReference() {
    state.layoutReferenceImage = '';
    state.layoutGenerationId = null;
    state.spaceMapMarkers = {};
    state.spaceLabeledLayoutImage = '';
    state.spaceMapMarkConfirmed = false;
  }

  function setSpaceMarkActiveLetter(letter) {
    var L = String(letter || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(L)) state.spaceMarkActiveLetter = L;
  }

  function invalidateSpaceMapMarkConfirm() {
    state.spaceMapMarkConfirmed = false;
    state.spaceLabeledLayoutImage = '';
  }

  function setSpaceMapMarker(letter, nx, ny) {
    var L = String(letter || '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(L)) return;
    var x = Math.max(0, Math.min(1, Number(nx)));
    var y = Math.max(0, Math.min(1, Number(ny)));
    if (!isFinite(x) || !isFinite(y)) return;
    var next = Object.assign({}, state.spaceMapMarkers);
    next[L] = { x: x, y: y };
    state.spaceMapMarkers = next;
    invalidateSpaceMapMarkConfirm();
    /* 自動對齊站點／望向到已標字母 */
    var keys = Object.keys(next);
    if (keys.length === 1) {
      state.spaceLookFrom = keys[0];
    } else if (keys.length >= 2) {
      if (!next[state.spaceLookFrom]) state.spaceLookFrom = keys[0];
      if (!next[state.spaceLookTo] || state.spaceLookTo === state.spaceLookFrom) {
        state.spaceLookTo = keys.find(function (k) { return k !== state.spaceLookFrom; }) || keys[1];
      }
    }
  }

  function clearSpaceMapMarkers() {
    state.spaceMapMarkers = {};
    state.spaceMarkActiveLetter = 'A';
    invalidateSpaceMapMarkConfirm();
  }

  function setSpaceLookFrom(letter) {
    var L = String(letter || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(L)) {
      state.spaceLookFrom = L;
      invalidateSpaceMapMarkConfirm();
    }
  }

  function setSpaceLookTo(letter) {
    var L = String(letter || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(L)) {
      state.spaceLookTo = L;
      invalidateSpaceMapMarkConfirm();
    }
  }

  function setSpaceLabeledLayoutImage(url) {
    state.spaceLabeledLayoutImage = url || '';
  }

  function setSpaceMapMarkConfirmed(ok) {
    state.spaceMapMarkConfirmed = !!ok;
  }

  function hasSpaceLookMarkers() {
    var from = state.spaceLookFrom || 'B';
    var to = state.spaceLookTo || 'C';
    var m = state.spaceMapMarkers || {};
    return !!(m[from] && m[to] && from !== to);
  }

  function isSpaceMapMarkConfirmed() {
    return !!state.spaceMapMarkConfirmed && hasSpaceLookMarkers() && !!state.spaceLabeledLayoutImage;
  }

  function setSpaceOutputType(type) {
    state.spaceOutputType = String(type || 'layout_plan').trim().toLowerCase() === 'eye_level' ? 'eye_level' : 'layout_plan';
  }

  function normalizeSpaceLayoutView(view) {
    var v = String(view || 'iso_45').trim().toLowerCase();
    if (v === 'top_down' || v === 'topdown' || v === 'bird_eye') return 'top_down';
    return 'iso_45';
  }

  function setSpaceLayoutView(view) {
    state.spaceLayoutView = normalizeSpaceLayoutView(view);
  }

  function setOutputCount(n) {
    state.outputCount = normalizePortraitOutputCount(n);
  }

  function normalizePortraitOutputCount(n) {
    var v = parseInt(n, 10);
    if (!isFinite(v) || v < 1) return 1;
    return Math.min(4, Math.max(1, v));
  }

  function setStyleImage(url) {
    state.styleImage = url || '';
  }

  function setStagingProductImage(url) {
    state.stagingProductImage = url || '';
  }

  function clearStagingProductImage() {
    state.stagingProductImage = '';
  }

  function setSceneReferenceImage(url) {
    state.sceneReferenceImage = url || '';
    if (state.shootMode === 'portrait' && state.sceneReferenceImage) {
      state.sceneKey = '';
    }
  }

  function clearSceneReferenceImage() {
    state.sceneReferenceImage = '';
  }

  function setSceneKey(key) {
    state.sceneKey = key ? String(key).trim() : '';
    if (state.shootMode === 'portrait' && state.sceneKey) {
      state.sceneReferenceImage = '';
    }
  }

  function canGenerate() {
    if (state.generating) return false;
    if (state.shootMode === 'space') {
      if (state.spaceOutputType === 'eye_level') {
        /* ISO 地圖 + 已按「確定標註」 */
        return !!(state.layoutReferenceImage || state.layoutGenerationId) && isSpaceMapMarkConfirmed();
      }
      /* 僅缺平面配置圖時禁用；風格描述改由送出時檢核 */
      return !!state.floorPlanImage;
    }
    if (state.shootMode === 'portrait') {
      if (!state.images.length) return false;
      /* 氛圍也要主題：只給 Nano Banana lite，不進 FLUX */
      return !!String(state.themeKey || '').trim();
    }
    return state.images.length > 0;
  }

  function buildGeneratePayload() {
    applyLookModeDefaults();
    var clientChannel = 'web';
    if (document.body && document.body.classList) {
      if (document.body.classList.contains('pc-embed-design')) clientChannel = 'embed';
      else if (document.body.classList.contains('pc-app-shell')) clientChannel = 'app';
    }
    var showOnHomepage = (global.MatchdoShowOnHomepageControl
      ? global.MatchdoShowOnHomepageControl.readChecked('pcShowOnHomepage')
      : true);

    if (state.shootMode === 'space') {
      applySpaceDimensions(state.aspectRatio || '1:1', state.spaceResolutionTier || '2k');
      if (state.spaceOutputType === 'eye_level') {
        applyLookModeDefaults();
        var camEye = Object.assign({}, state.camera);
        camEye._look_mode = state.lookMode;
        var hiddenEye = getUiConfig().ui_hidden_categories || [];
        hiddenEye.forEach(function (cat) { delete camEye[cat]; });
        delete camEye.shooting_angle;
        delete camEye.subject_preservation;
        var eyePayload = {
          shoot_mode: 'space',
          space_output_type: 'eye_level',
          space_use_type: state.spaceUseType || 'residential',
          space_resolution_tier: state.spaceResolutionTier || '2k',
          layout_generation_id: state.layoutGenerationId || undefined,
          layout_image: state.spaceLabeledLayoutImage || state.layoutReferenceImage || undefined,
          look_from: state.spaceLookFrom || 'B',
          look_to: state.spaceLookTo || 'C',
          map_markers: state.spaceMapMarkers || undefined,
          user_prompt: state.userPrompt || undefined,
          width: state.width,
          height: state.height,
          aspect_ratio: state.aspectRatio,
          camera: camEye,
          client_channel: clientChannel,
          show_on_homepage: showOnHomepage
        };
        if (state.stagingProductImage) eyePayload.product_image = state.stagingProductImage;
        /* 字母標註＝區域；不再送區域批次勾選 */
        return eyePayload;
      }
      applyLookModeDefaults();
      var camSpace = Object.assign({}, state.camera);
      camSpace._look_mode = state.lookMode;
      var hiddenSpace = getUiConfig().ui_hidden_categories || [];
      hiddenSpace.forEach(function (cat) { delete camSpace[cat]; });
      delete camSpace.shooting_angle;
      delete camSpace.subject_preservation;
      var spacePayload = {
        shoot_mode: 'space',
        space_output_type: state.spaceOutputType || 'layout_plan',
        space_layout_view: state.spaceLayoutView || 'iso_45',
        space_style_source: state.spaceStyleSource,
        space_use_type: state.spaceUseType || 'residential',
        space_resolution_tier: state.spaceResolutionTier || '2k',
        floor_plan: state.floorPlanImage,
        style_image: state.spaceStyleSource === 'image' ? state.styleImage : undefined,
        user_prompt: state.userPrompt || undefined,
        width: state.width,
        height: state.height,
        aspect_ratio: state.aspectRatio,
        camera: camSpace,
        client_channel: clientChannel,
        show_on_homepage: showOnHomepage
      };
      if (state.stagingProductImage) {
        spacePayload.product_image = state.stagingProductImage;
      }
      return spacePayload;
    }

    var cam = Object.assign({}, state.camera);
    cam._look_mode = state.lookMode;
    var hidden = getUiConfig().ui_hidden_categories || [];
    hidden.forEach(function (cat) { delete cam[cat]; });
    /* 人像 UI 不顯示角度／人物保留；勿把產品預設 keep_reference／keep 送進 API（會鎖姿勢） */
    if (state.shootMode === 'portrait') {
      delete cam.shooting_angle;
      delete cam.subject_preservation;
      var angleCatP = getAngleCategory();
      if (angleCatP) delete cam[angleCatP];
    }
    var clientChannel = 'web';
    if (document.body && document.body.classList) {
      if (document.body.classList.contains('pc-embed-design')) clientChannel = 'embed';
      else if (document.body.classList.contains('pc-app-shell')) clientChannel = 'app';
    }
    var fluxPayload = {
      shoot_mode: state.shootMode === 'portrait' ? 'portrait' : 'product',
      images: state.images.slice(),
      theme_key: state.themeKey || undefined,
      scene_key: (state.shootMode === 'portrait' && state.sceneReferenceImage)
        ? undefined
        : (state.sceneKey || undefined),
      aspect_ratio: state.aspectRatio,
      width: state.width,
      height: state.height,
      user_prompt: state.userPrompt || undefined,
      output_count: state.shootMode === 'portrait' ? normalizePortraitOutputCount(state.outputCount) : 1,
      source_type: state.sourceType,
      source_id: state.sourceId || undefined,
      client_channel: clientChannel,
      camera: cam,
      show_on_homepage: (global.MatchdoShowOnHomepageControl
        ? global.MatchdoShowOnHomepageControl.readChecked('pcShowOnHomepage')
        : true)
    };
    if (state.shootMode === 'portrait') {
      applySpaceDimensions(state.aspectRatio || '1:1', state.spaceResolutionTier || '2k');
      fluxPayload.space_resolution_tier = state.spaceResolutionTier || '2k';
      fluxPayload.width = state.width;
      fluxPayload.height = state.height;
      fluxPayload.aspect_ratio = state.aspectRatio;
      fluxPayload.portrait_render_mode = state.portraitRenderMode === 'mood' ? 'mood' : 'clear';
      if (state.portraitRenderMode === 'mood') {
        fluxPayload.portrait_people_count = state.portraitPeopleCount >= 1 && state.portraitPeopleCount <= 4
          ? state.portraitPeopleCount
          : 1;
        fluxPayload.portrait_subject_gender = state.portraitSubjectGender === 'male' ? 'male' : 'female';
      }
    }
    if (state.shootMode === 'portrait' && state.stagingProductImage) {
      fluxPayload.product_image = state.stagingProductImage;
    }
    if (state.shootMode === 'portrait' && state.sceneReferenceImage) {
      fluxPayload.scene_image = state.sceneReferenceImage;
    }
    return fluxPayload;
  }

  function labelFor(cat, key) {
    var opts = state.options && state.options.camera_params ? state.options.camera_params : {};
    var list = opts[cat] || [];
    var hit = list.find(function (r) { return r.key === key; });
    return hit ? (hit.name || key) : (key || '—');
  }

  function getLcdSummary() {
    var cam = state.camera || {};
    var digitalCat = getDigitalLookCategory();
    var filmCat = getFilmLookCategory();
    var lookKey = state.lookMode === 'film' ? cam[filmCat] : cam[digitalCat];
    var lookCat = state.lookMode === 'film' ? filmCat : digitalCat;
    var lensCat = getLensCategory();
    var angleCat = getAngleCategory();
    return {
      lookMode: state.lookMode,
      look: labelFor(lookCat, lookKey),
      lens: labelFor(lensCat, cam[lensCat]),
      angle: labelFor(angleCat, cam[angleCat]),
      aperture: labelFor('aperture', cam.aperture),
      ev: labelFor('exposure_ev', cam.exposure_ev),
      blades: labelFor('aperture_blades', cam.aperture_blades)
    };
  }

  global.PromoCameraState = {
    MAX_IMAGES: MAX_IMAGES,
    getUiConfig: getUiConfig,
    getLookGroup: getLookGroup,
    getDigitalLookCategory: getDigitalLookCategory,
    getFilmLookCategory: getFilmLookCategory,
    getLensCategory: getLensCategory,
    getAngleCategory: getAngleCategory,
    getSubjectPreservationCategory: getSubjectPreservationCategory,
    getCategoryLabel: getCategoryLabel,
    visibleCategories: visibleCategories,
    getThemesForMode: getThemesForMode,
    setShootMode: setShootMode,
    setPortraitRenderMode: setPortraitRenderMode,
    setPortraitPeopleCount: setPortraitPeopleCount,
    setPortraitSubjectGender: setPortraitSubjectGender,
    setSpaceStyleSource: setSpaceStyleSource,
    setSpaceUseType: setSpaceUseType,
    getSpaceZoneIntentsForUseType: getSpaceZoneIntentsForUseType,
    setSpaceZoneIntentKeys: setSpaceZoneIntentKeys,
    toggleSpaceZoneIntent: toggleSpaceZoneIntent,
    setSpaceResolutionTier: setSpaceResolutionTier,
    setSpaceMegapixels: setSpaceMegapixels,
    setSpaceAspectRatio: setSpaceAspectRatio,
    applySpaceDimensions: applySpaceDimensions,
    setFloorPlanImage: setFloorPlanImage,
    setPlanningSimFurnitureImage: setPlanningSimFurnitureImage,
    setLayoutReference: setLayoutReference,
    clearLayoutReference: clearLayoutReference,
    setSpaceMarkActiveLetter: setSpaceMarkActiveLetter,
    setSpaceMapMarker: setSpaceMapMarker,
    clearSpaceMapMarkers: clearSpaceMapMarkers,
    setSpaceLookFrom: setSpaceLookFrom,
    setSpaceLookTo: setSpaceLookTo,
    setSpaceLabeledLayoutImage: setSpaceLabeledLayoutImage,
    setSpaceMapMarkConfirmed: setSpaceMapMarkConfirmed,
    hasSpaceLookMarkers: hasSpaceLookMarkers,
    isSpaceMapMarkConfirmed: isSpaceMapMarkConfirmed,
    setSpaceOutputType: setSpaceOutputType,
    setSpaceLayoutView: setSpaceLayoutView,
    setOutputCount: setOutputCount,
    setStagingProductImage: setStagingProductImage,
    clearStagingProductImage: clearStagingProductImage,
    setSceneReferenceImage: setSceneReferenceImage,
    clearSceneReferenceImage: clearSceneReferenceImage,
    setSceneKey: setSceneKey,
    setStyleImage: setStyleImage,
    canGenerate: canGenerate,
    get: function () { return state; },
    cloneMessages: cloneMessages,
    setOptions: setOptions,
    applyShootModeCameraDefaults: applyShootModeCameraDefaults,
    getCameraDefaultsForMode: getCameraDefaultsForMode,
    addImage: addImage,
    removeImage: removeImage,
    clearImages: clearImages,
    setLookMode: setLookMode,
    setCameraKey: setCameraKey,
    setDims: setDims,
    apertureOptionsForCurrentLens: apertureOptionsForCurrentLens,
    clampApertureToLens: clampApertureToLens,
    toPresetSnapshot: toPresetSnapshot,
    applyPreset: applyPreset,
    pushMessage: pushMessage,
    buildGeneratePayload: buildGeneratePayload,
    getLcdSummary: getLcdSummary
  };
})(typeof window !== 'undefined' ? window : this);
