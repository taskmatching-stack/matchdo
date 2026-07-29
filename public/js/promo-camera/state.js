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
      focal_length: '鏡頭／焦段',
      aperture_blades: '光圈葉片'
    },
    exclusive_groups: [
      { id: 'look', label: '成像來源', categories: ['camera_brand', 'film_simulation'], default_category: 'camera_brand' }
    ],
    ui_hidden_categories: ['lens_type'],
    lens_primary_category: 'focal_length',
    groupable_categories: ['film_simulation', 'focal_length'],
    group_meta_key: 'group'
  };

  var state = {
    options: null,
    images: [],
    sourceType: 'upload',
    sourceId: null,
    themeKey: '',
    sceneKey: '',
    aspectRatio: '1:1',
    megapixels: 1,
    width: 1024,
    height: 1024,
    userPrompt: '',
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

  function visibleCategories() {
    var hidden = getUiConfig().ui_hidden_categories || ['lens_type'];
    var hiddenSet = {};
    hidden.forEach(function (c) { hiddenSet[c] = true; });
    var out = ['focal_length', 'aperture', 'exposure_ev', 'aperture_blades'];
    return out.filter(function (c) { return !hiddenSet[c]; });
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
  }

  function setOptions(data) {
    state.options = data || null;
    if (data && data.camera_defaults) {
      state.camera = Object.assign({}, data.camera_defaults);
    }
    state.lookMode = inferLookModeFromCamera();
    applyLookModeDefaults();
    if (data && data.themes && data.themes.length && !state.themeKey) {
      state.themeKey = data.themes[0].key || '';
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
  }

  function setDims(w, h, ratio, mp) {
    state.width = w;
    state.height = h;
    if (ratio) state.aspectRatio = ratio;
    if (mp) state.megapixels = mp;
  }

  function pushMessage(role, text, extra) {
    state.messages.push({
      role: role,
      text: text || '',
      extra: extra || null,
      at: Date.now()
    });
  }

  function buildGeneratePayload() {
    applyLookModeDefaults();
    var cam = Object.assign({}, state.camera);
    cam._look_mode = state.lookMode;
    var hidden = getUiConfig().ui_hidden_categories || [];
    hidden.forEach(function (cat) { delete cam[cat]; });
    return {
      images: state.images.slice(),
      theme_key: state.themeKey || undefined,
      scene_key: state.sceneKey || undefined,
      aspect_ratio: state.aspectRatio,
      width: state.width,
      height: state.height,
      user_prompt: state.userPrompt || undefined,
      source_type: state.sourceType,
      source_id: state.sourceId || undefined,
      camera: cam
    };
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
    return {
      lookMode: state.lookMode,
      look: labelFor(lookCat, lookKey),
      lens: labelFor('focal_length', cam.focal_length),
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
    getCategoryLabel: getCategoryLabel,
    visibleCategories: visibleCategories,
    get: function () { return state; },
    cloneMessages: cloneMessages,
    setOptions: setOptions,
    addImage: addImage,
    removeImage: removeImage,
    clearImages: clearImages,
    setLookMode: setLookMode,
    setCameraKey: setCameraKey,
    setDims: setDims,
    pushMessage: pushMessage,
    buildGeneratePayload: buildGeneratePayload,
    getLcdSummary: getLcdSummary
  };
})(typeof window !== 'undefined' ? window : this);
