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
    spaceStyleSource: 'prompt',
    spaceUseType: 'residential',
    spaceResolutionTier: '2k',
    spaceZoneIntentKeys: [],
    floorPlanImage: '',
    layoutReferenceImage: '',
    layoutGenerationId: null,
    styleImage: '',
    stagingProductImage: '',
    themeKey: '',
    sceneKey: '',
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

  function applyLookModeDefaults() {
    var digitalCat = getDigitalLookCategory();
    var filmCat = getFilmLookCategory();
    var defs = (state.options && state.options.camera_defaults) || {};
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

  function setOptions(data) {
    state.options = data || null;
    if (data && data.camera_defaults) {
      state.camera = Object.assign({}, data.camera_defaults);
    }
    state.lookMode = inferLookModeFromCamera();
    applyLookModeDefaults();
    clampApertureToLens();
    if (data) {
      var themes = getThemesForMode(state.shootMode);
      if (themes.length && !state.themeKey) {
        state.themeKey = themes[0].key || '';
      }
    }
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
    var defs = (state.options && state.options.camera_defaults) || {};
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
    if (sceneKeyExists(preset.sceneKey)) state.sceneKey = preset.sceneKey || '';
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

    if (state.shootMode === 'space') {
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
    return String(raw || '2k').trim().toLowerCase() === '4k' ? '4k' : '2k';
  }

  function applySpaceDimensions(ratio, tier) {
    var Promo = global.MatchdoPromoImage;
    if (!Promo || typeof Promo.dimsForSpaceRatio !== 'function') {
      var t = normalizeSpaceResolutionTier(tier);
      var edge = t === '4k' ? 4096 : 2048;
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
      : (parseInt(mp, 10) >= 16 ? '4k' : '2k');
    setSpaceResolutionTier(tier);
  }

  function setSpaceAspectRatio(ratio) {
    state.aspectRatio = ratio || '1:1';
    applySpaceDimensions(state.aspectRatio, state.spaceResolutionTier);
  }

  function setFloorPlanImage(url) {
    state.floorPlanImage = url || '';
  }

  function setLayoutReference(url, generationId) {
    state.layoutReferenceImage = url || '';
    state.layoutGenerationId = generationId ? String(generationId) : null;
  }

  function clearLayoutReference() {
    state.layoutReferenceImage = '';
    state.layoutGenerationId = null;
  }

  function setSpaceOutputType(type) {
    state.spaceOutputType = String(type || 'layout_plan').trim().toLowerCase() === 'eye_level' ? 'eye_level' : 'layout_plan';
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

  function canGenerate() {
    if (state.generating) return false;
    if (state.shootMode === 'space') {
      if (state.spaceOutputType === 'eye_level') {
        /* 僅缺 ISO 對照圖時禁用；視角／區域改由送出時檢核 */
        return !!(state.layoutReferenceImage || state.layoutGenerationId);
      }
      /* 僅缺平面配置圖時禁用；風格描述改由送出時檢核 */
      return !!state.floorPlanImage;
    }
    if (state.shootMode === 'portrait') {
      if (!state.images.length) return false;
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
        var eyePayload = {
          shoot_mode: 'space',
          space_output_type: 'eye_level',
          space_use_type: state.spaceUseType || 'residential',
          space_resolution_tier: state.spaceResolutionTier || '2k',
          layout_generation_id: state.layoutGenerationId || undefined,
          layout_image: state.layoutReferenceImage || undefined,
          user_prompt: state.userPrompt || undefined,
          width: state.width,
          height: state.height,
          aspect_ratio: state.aspectRatio,
          camera: camEye,
          client_channel: clientChannel,
          show_on_homepage: showOnHomepage
        };
        if (state.stagingProductImage) eyePayload.product_image = state.stagingProductImage;
        var zoneKeys = (state.spaceZoneIntentKeys || []).slice();
        if (zoneKeys.length) {
          eyePayload.view_mode = 'guided';
          eyePayload.shot_intent_keys = zoneKeys;
          if (state.userPrompt) eyePayload.user_prompt = state.userPrompt;
        } else {
          eyePayload.user_prompt = state.userPrompt || undefined;
        }
        return eyePayload;
      }
      applyLookModeDefaults();
      var camSpace = Object.assign({}, state.camera);
      camSpace._look_mode = state.lookMode;
      var hiddenSpace = getUiConfig().ui_hidden_categories || [];
      hiddenSpace.forEach(function (cat) { delete camSpace[cat]; });
      var spacePayload = {
        shoot_mode: 'space',
        space_output_type: state.spaceOutputType || 'layout_plan',
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
    var clientChannel = 'web';
    if (document.body && document.body.classList) {
      if (document.body.classList.contains('pc-embed-design')) clientChannel = 'embed';
      else if (document.body.classList.contains('pc-app-shell')) clientChannel = 'app';
    }
    var fluxPayload = {
      shoot_mode: state.shootMode === 'portrait' ? 'portrait' : 'product',
      images: state.images.slice(),
      theme_key: state.themeKey || undefined,
      scene_key: state.sceneKey || undefined,
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
    if (state.shootMode === 'portrait' && state.stagingProductImage) {
      fluxPayload.product_image = state.stagingProductImage;
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
    setLayoutReference: setLayoutReference,
    clearLayoutReference: clearLayoutReference,
    setSpaceOutputType: setSpaceOutputType,
    setOutputCount: setOutputCount,
    setStagingProductImage: setStagingProductImage,
    clearStagingProductImage: clearStagingProductImage,
    setStyleImage: setStyleImage,
    canGenerate: canGenerate,
    get: function () { return state; },
    cloneMessages: cloneMessages,
    setOptions: setOptions,
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
