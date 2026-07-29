/**
 * 攝影模擬 — 狀態（無 DOM）
 */
(function (global) {
  'use strict';

  var MAX_IMAGES = 1;

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
    messages: [],
    generating: false,
    lastResult: null
  };

  var CATEGORY_LABELS = {
    camera_brand: '畫質／機身質感',
    film_simulation: '底片／風格',
    aperture: '光圈',
    exposure_ev: 'EV 曝光',
    focal_length: '焦段',
    lens_type: '鏡頭類型',
    aperture_blades: '光圈葉片'
  };

  function cloneMessages() {
    return state.messages.slice();
  }

  function setOptions(data) {
    state.options = data || null;
    if (data && data.camera_defaults) {
      state.camera = Object.assign({}, data.camera_defaults);
    }
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

  function setCameraKey(category, key) {
    if (!category) return;
    state.camera[category] = key || '';
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
      camera: Object.assign({}, state.camera)
    };
  }

  function getLcdSummary() {
    var cam = state.camera || {};
    var opts = state.options && state.options.camera_params ? state.options.camera_params : {};
    function label(cat, key) {
      var list = opts[cat] || [];
      var hit = list.find(function (r) { return r.key === key; });
      return hit ? (hit.name || key) : (key || '—');
    }
    return {
      aperture: label('aperture', cam.aperture),
      focal: label('focal_length', cam.focal_length),
      film: label('film_simulation', cam.film_simulation),
      ev: label('exposure_ev', cam.exposure_ev)
    };
  }

  global.PromoCameraState = {
    MAX_IMAGES: MAX_IMAGES,
    CATEGORY_LABELS: CATEGORY_LABELS,
    get: function () { return state; },
    cloneMessages: cloneMessages,
    setOptions: setOptions,
    addImage: addImage,
    removeImage: removeImage,
    clearImages: clearImages,
    setCameraKey: setCameraKey,
    setDims: setDims,
    pushMessage: pushMessage,
    buildGeneratePayload: buildGeneratePayload,
    getLcdSummary: getLcdSummary
  };
})(typeof window !== 'undefined' ? window : this);
