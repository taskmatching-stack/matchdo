/**
 * 數位資產選擇器（設計稿／材料組合／印花／情境圖／我的最愛）— custom-product、promo-camera 共用
 */
(function (global) {
  'use strict';

  var TAB_I18N = {
    designs: { zh: '設計稿', en: 'Design drafts', key: 'myCustomProducts.tabDesigns' },
    material_combo: { zh: '材料組合', en: 'Material combo', key: 'nav.materialCombination' },
    print: { zh: '印花', en: 'Print', key: 'nav.printAsset' },
    promo: { zh: '情境圖', en: 'Scene images', key: 'myCustomProducts.tabPromo' },
    favorites: { zh: '我的最愛', en: 'Favorites', key: 'home.myFavorites' }
  };

  function tLabel(meta) {
    try {
      if (global.i18n && typeof global.i18n.t === 'function' && meta.key) {
        var v = global.i18n.t(meta.key);
        if (v && v !== meta.key) return v;
      }
    } catch (_) {}
    var lang = '';
    try {
      lang = String((global.i18n && global.i18n.getLang && global.i18n.getLang()) || global.__MATCHDO_LANG || '').toLowerCase();
    } catch (_) {}
    return lang.indexOf('zh') === 0 ? meta.zh : meta.en;
  }

  function getTabs() {
    return Object.keys(TAB_I18N).map(function (key) {
      return { key: key, label: tLabel(TAB_I18N[key]) };
    });
  }

  var TABS = getTabs();

  function refreshTabs() {
    TABS = getTabs();
    return TABS;
  }

  function isZhUi() {
    var lang = '';
    try {
      lang = String((global.i18n && global.i18n.getLang && global.i18n.getLang()) || global.__MATCHDO_LANG || '').toLowerCase();
    } catch (_) {}
    return lang.indexOf('zh') === 0 || !lang;
  }

  function fallbackTitle(tab) {
    if (tab === 'print') return isZhUi() ? '印花' : 'Print';
    if (tab === 'promo') return isZhUi() ? '情境圖' : 'Scene image';
    if (tab === 'material_combo') return isZhUi() ? '材料組合' : 'Material combo';
    if (tab === 'favorites') return isZhUi() ? '我的最愛' : 'Favorite';
    return isZhUi() ? '設計稿' : 'Design draft';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function authHeaders() {
    return Promise.resolve().then(function () {
      if (global.AuthService && typeof global.AuthService.getSession === 'function') {
        return global.AuthService.getSession();
      }
      return null;
    }).then(function (session) {
      var tok = (session && session.access_token) || global.__MATCHDO_ACCESS_TOKEN || '';
      return tok ? { Authorization: 'Bearer ' + tok } : {};
    });
  }

  function fetchTabItems(tab) {
    return authHeaders().then(function (headers) {
      if (!headers.Authorization) return { ok: false, error: 'login' };
      var url;
      // 印花：接 user_print_generations；表未建時 API 回空
      if (tab === 'print') url = '/api/me/print-generations?limit=48&offset=0';
      else if (tab === 'promo') url = '/api/promo-image/generations?limit=48&offset=0';
      else if (tab === 'favorites') url = '/api/me/favorites';
      else if (tab === 'material_combo') url = '/api/me/material-combo-generations?limit=48&offset=0';
      else url = '/api/custom-products?gallery=1&limit=48&offset=0';
      return fetch(url, { headers: headers, cache: 'no-store' }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      });
    });
  }

  function normalizeItems(tab, data) {
    var items = [];
    if (tab === 'print') {
      (data.items || []).forEach(function (row) {
        var url = (row.image_url || '').trim();
        if (!url) return;
        var meta = row.print_meta || null;
        var title = (row.title || '').trim();
        if (!title && meta && meta.print_type) title = String(meta.print_type);
        var cat = (row.category || '').trim();
        var label = title || fallbackTitle('print');
        if (cat) label = label + ' · ' + cat;
        items.push({
          url: url,
          title: label.substring(0, 48),
          sourceType: 'print',
          sourceId: row.id || null,
          badge: cat || fallbackTitle('print'),
          category: cat || null,
          print_meta: meta
        });
      });
      return items;
    }
    if (tab === 'promo') {
      (data.items || []).forEach(function (row) {
        var url = (row.image_url || '').trim();
        if (!url) return;
        var ratio = row.aspect_ratio ? (' · ' + row.aspect_ratio) : '';
        items.push({
          url: url,
          title: ((row.user_prompt || fallbackTitle('promo')) + ratio).trim().substring(0, 48),
          sourceType: 'digital_asset',
          sourceId: row.id || null,
          badge: fallbackTitle('promo')
        });
      });
      return items;
    }
    if (tab === 'favorites') {
      (data.favorites || []).forEach(function (f) {
        var item = f.item || {};
        var url = (item.image_url || item.cover_image_url || '').trim();
        if (!url) return;
        items.push({
          url: url,
          title: (item.title || fallbackTitle('favorites')).substring(0, 48),
          sourceType: 'digital_asset',
          sourceId: null,
          badge: isZhUi() ? '最愛' : 'Fav'
        });
      });
      return items;
    }
    if (tab === 'material_combo') {
      (data.items || []).forEach(function (row) {
        var url = (row.image_url || '').trim();
        if (!url) return;
        var combo = row.material_combo || null;
        if (combo && row.id) {
          combo = Object.assign({}, combo, { source_generation_id: row.id });
        }
        var title = (row.title || '').trim();
        if (!title && combo && combo.main && combo.accent) {
          title = [combo.main.material, combo.accent.material].filter(Boolean).join('／');
        }
        var cat = (row.category || '').trim();
        var label = title || fallbackTitle('material_combo');
        if (cat) label = label + ' · ' + cat;
        items.push({
          url: url,
          title: label.substring(0, 48),
          sourceType: 'material_combo',
          sourceId: row.id || null,
          badge: cat || fallbackTitle('material_combo'),
          category: cat || null,
          material_combo: combo
        });
      });
      return items;
    }
    (data.products || []).forEach(function (p) {
      var url = (p.ai_generated_image_url || p.image_url || '').trim();
      if (!url) return;
      items.push({
        url: url,
        title: (p.title || p.generation_prompt || fallbackTitle('designs')).substring(0, 48),
        sourceType: p.id ? 'custom_product' : 'digital_asset',
        sourceId: p.id || null,
        badge: null
      });
    });
    return items;
  }

  function renderTabs(container, activeTab, onChange, allowedTabs) {
    if (!container) return;
    var tabs = TABS;
    if (Array.isArray(allowedTabs) && allowedTabs.length) {
      var allow = {};
      allowedTabs.forEach(function (k) { allow[k] = true; });
      tabs = TABS.filter(function (t) { return allow[t.key]; });
      if (!tabs.length) tabs = TABS;
    }
    if (tabs.length <= 1) {
      container.innerHTML = '';
      container.classList.add('d-none');
    } else {
      container.classList.remove('d-none');
      container.innerHTML = tabs.map(function (t) {
        return '<button type="button" class="dap-tab' + (t.key === activeTab ? ' active' : '') + '" data-dap-tab="' + t.key + '">' + esc(t.label) + '</button>';
      }).join('');
      container.querySelectorAll('[data-dap-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.getAttribute('data-dap-tab');
          if (!key || key === activeTab) return;
          onChange(key);
        });
      });
    }
  }

  function openBrowseLightbox(listEl, items, index) {
    if (!global.MatchdoImageLightbox || typeof global.MatchdoImageLightbox.open !== 'function') return;
    var imageItems = (items || []).map(function (item) {
      return { url: (item.url || '').trim(), label: item.title || '' };
    }).filter(function (it) { return it.url; });
    if (!imageItems.length) return;
    var idx = Math.max(0, Math.min(index || 0, imageItems.length - 1));
    global.MatchdoImageLightbox.open({ imageItems: imageItems, index: idx });
  }

  function renderGrid(listEl, items, onPick, gridOpts) {
    if (!listEl) return;
    gridOpts = gridOpts || {};
    var browseMode = gridOpts.mode === 'browse';
    listEl.innerHTML = '';
    items.forEach(function (item, index) {
      var col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3';
      var badge = item.badge ? '<span class="dap-badge">' + esc(item.badge) + '</span>' : '';
      var zoomHint = browseMode ? '<span class="dap-zoom-hint"><i class="bi bi-zoom-in" aria-hidden="true"></i></span>' : '';
      col.innerHTML =
        '<div class="dap-card' + (browseMode ? ' dap-card--browse' : '') + '" tabindex="0" role="button"' +
        ' data-url="' + esc(item.url) + '"' +
        ' data-index="' + index + '"' +
        ' data-source-type="' + esc(item.sourceType || 'digital_asset') + '"' +
        ' data-source-id="' + esc(item.sourceId || '') + '">' +
        '<div class="dap-thumb-wrap">' + badge + zoomHint +
        '<img class="dap-thumb" src="' + esc(item.url) + '" alt="" loading="lazy" decoding="async">' +
        '</div>' +
        '<p class="dap-title">' + esc(item.title || '') + '</p></div>';
      listEl.appendChild(col);
    });
    listEl.querySelectorAll('.dap-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (browseMode) {
          var idx = parseInt(card.getAttribute('data-index'), 10);
          openBrowseLightbox(listEl, items, isNaN(idx) ? 0 : idx);
          return;
        }
        var idx = parseInt(card.getAttribute('data-index'), 10);
        var item = items[isNaN(idx) ? 0 : idx] || {};
        onPick({
          url: card.getAttribute('data-url'),
          sourceType: card.getAttribute('data-source-type') || 'digital_asset',
          sourceId: card.getAttribute('data-source-id') || null,
          material_combo: item.material_combo || null
        });
      });
    });
  }

  function emptyMessage(tab) {
    if (isZhUi()) {
      if (tab === 'material_combo') return '尚無材料組合，請至「材料組合」頁生成後會自動出現於此。';
      if (tab === 'print') return '尚無印花，請至「印花」頁上傳（可選 AI 重繪）後存入。';
      if (tab === 'promo') return '尚無情境圖，請先在商攝導演或設計頁生成。';
      if (tab === 'favorites') return '尚無收藏，或收藏項目沒有可用的圖片。';
      return '尚無設計稿，請先在產品設計中生成並儲存。';
    }
    if (tab === 'material_combo') return 'No material combos yet. Generate on the Material combination page.';
    if (tab === 'print') return 'No prints yet. Upload on the Print page (AI redraw optional), then save.';
    if (tab === 'promo') return 'No scene images yet. Generate in Promo Camera or Product Design first.';
    if (tab === 'favorites') return 'No favorites yet, or favorites have no usable image.';
    return 'No design drafts yet. Generate in Product Design and save first.';
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.tabsEl
   * @param {HTMLElement} opts.listEl  row g-2 container
   * @param {HTMLElement} opts.emptyEl
   * @param {HTMLElement} opts.loadingEl
   * @param {function} [opts.onPick] ({url, sourceType, sourceId})
   * @param {string} [opts.initialTab]
   * @param {string[]} [opts.allowedTabs] 僅顯示這些 TAB（例：['print']）
   * @param {string} [opts.mode] 'pick'（預設）| 'browse'（點擊放大，不選圖）
   */
  function mount(opts) {
    opts = opts || {};
    refreshTabs();
    var mode = opts.mode === 'browse' ? 'browse' : 'pick';
    var allowedTabs = Array.isArray(opts.allowedTabs) ? opts.allowedTabs : null;
    var initial = opts.initialTab || 'designs';
    if (allowedTabs && allowedTabs.length && allowedTabs.indexOf(initial) < 0) {
      initial = allowedTabs[0];
    }
    var state = { tab: initial, items: [] };

    function load(tab) {
      state.tab = tab;
      if (opts.tabsEl) {
        renderTabs(opts.tabsEl, tab, load, allowedTabs);
      }
      if (opts.listEl) opts.listEl.innerHTML = '';
      if (opts.emptyEl) opts.emptyEl.classList.add('d-none');
      if (opts.loadingEl) opts.loadingEl.classList.remove('d-none');

      fetchTabItems(tab).then(function (res) {
        if (opts.loadingEl) opts.loadingEl.classList.add('d-none');
        if (!res.ok) {
          if (opts.emptyEl) {
            opts.emptyEl.textContent = res.error === 'login' ? '請先登入' : '載入失敗，請稍後再試。';
            opts.emptyEl.classList.remove('d-none');
          }
          return;
        }
        var payload = res.data || {};
        var items = normalizeItems(tab, payload);
        if (!items.length) {
          if (opts.emptyEl) {
            if (tab === 'material_combo' && payload.table_missing) {
              opts.emptyEl.textContent = isZhUi()
                ? '材料組合資料表尚未建立。請在 Supabase 執行 docs/add-user-material-combo-generations.sql 後再生成；建表前的生成不會出現在此。'
                : 'Material combo table is missing. Run docs/add-user-material-combo-generations.sql in Supabase, then generate again.';
            } else if (tab === 'print' && payload.table_missing) {
              opts.emptyEl.textContent = isZhUi()
                ? '印花資料表尚未建立。請在 Supabase 執行 docs/add-user-print-generations.sql 後再上傳。'
                : 'Print table is missing. Run docs/add-user-print-generations.sql in Supabase, then upload again.';
            } else {
              opts.emptyEl.textContent = emptyMessage(tab);
            }
            opts.emptyEl.classList.remove('d-none');
          }
          return;
        }
        if (opts.emptyEl) opts.emptyEl.classList.add('d-none');
        state.items = items;
        renderGrid(opts.listEl, items, opts.onPick, { mode: mode });
      }).catch(function () {
        if (opts.loadingEl) opts.loadingEl.classList.add('d-none');
        if (opts.emptyEl) {
          opts.emptyEl.textContent = isZhUi() ? '載入失敗，請稍後再試。' : 'Failed to load. Please try again.';
          opts.emptyEl.classList.remove('d-none');
        }
      });
    }

    load(state.tab);
    return { reload: function (tab) { load(tab || state.tab); } };
  }

  global.MatchdoDigitalAssetPicker = {
    mount: mount,
    get TABS() { return refreshTabs(); },
    getTabs: getTabs,
    refreshTabs: refreshTabs,
    fetchTabItems: fetchTabItems,
    normalizeItems: normalizeItems,
    emptyMessage: emptyMessage
  };
})(typeof window !== 'undefined' ? window : this);
