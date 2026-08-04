/**
 * 數位資產選擇器（設計圖／材料組合／情境圖／我的最愛）— custom-product、promo-camera 共用
 */
(function (global) {
  'use strict';

  var TABS = [
    { key: 'designs', label: '設計圖' },
    { key: 'material_combo', label: '材料組合' },
    { key: 'promo', label: '情境圖' },
    { key: 'favorites', label: '我的最愛' }
  ];

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
      if (tab === 'promo') url = '/api/promo-image/generations?limit=48&offset=0';
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
    if (tab === 'promo') {
      (data.items || []).forEach(function (row) {
        var url = (row.image_url || '').trim();
        if (!url) return;
        var ratio = row.aspect_ratio ? (' · ' + row.aspect_ratio) : '';
        items.push({
          url: url,
          title: ((row.user_prompt || '情境圖') + ratio).trim().substring(0, 48),
          sourceType: 'digital_asset',
          sourceId: row.id || null,
          badge: '情境圖'
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
          title: (item.title || '我的最愛').substring(0, 48),
          sourceType: 'digital_asset',
          sourceId: null,
          badge: '最愛'
        });
      });
      return items;
    }
    if (tab === 'material_combo') {
      (data.items || []).forEach(function (row) {
        var url = (row.image_url || '').trim();
        if (!url) return;
        var combo = row.material_combo || null;
        var title = (row.title || '').trim();
        if (!title && combo && combo.main && combo.accent) {
          title = [combo.main.material, combo.accent.material].filter(Boolean).join('／');
        }
        items.push({
          url: url,
          title: (title || '材料組合').substring(0, 48),
          sourceType: 'material_combo',
          sourceId: row.id || null,
          badge: '材料組合',
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
        title: (p.title || p.generation_prompt || '設計圖').substring(0, 48),
        sourceType: p.id ? 'custom_product' : 'digital_asset',
        sourceId: p.id || null,
        badge: null
      });
    });
    return items;
  }

  function renderTabs(container, activeTab, onChange) {
    if (!container) return;
    container.innerHTML = TABS.map(function (t) {
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
    if (tab === 'material_combo') return '尚無材料組合，請至「材料組合」頁生成後會自動出現於此。';
    if (tab === 'promo') return '尚無情境圖，請先在商攝導演或設計頁生成。';
    if (tab === 'favorites') return '尚無收藏，或收藏項目沒有可用的圖片。';
    return '尚無設計圖，請先在產品設計中生成並儲存。';
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.tabsEl
   * @param {HTMLElement} opts.listEl  row g-2 container
   * @param {HTMLElement} opts.emptyEl
   * @param {HTMLElement} opts.loadingEl
   * @param {function} [opts.onPick] ({url, sourceType, sourceId})
   * @param {string} [opts.initialTab]
   * @param {string} [opts.mode] 'pick'（預設）| 'browse'（點擊放大，不選圖）
   */
  function mount(opts) {
    opts = opts || {};
    var mode = opts.mode === 'browse' ? 'browse' : 'pick';
    var state = { tab: opts.initialTab || 'designs', items: [] };

    function load(tab) {
      state.tab = tab;
      if (opts.tabsEl) {
        renderTabs(opts.tabsEl, tab, load);
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
              opts.emptyEl.textContent = '材料組合資料表尚未建立。請在 Supabase 執行 docs/add-user-material-combo-generations.sql 後再生成；建表前的生成不會出現在此。';
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
          opts.emptyEl.textContent = '載入失敗，請稍後再試。';
          opts.emptyEl.classList.remove('d-none');
        }
      });
    }

    load(state.tab);
    return { reload: function (tab) { load(tab || state.tab); } };
  }

  global.MatchdoDigitalAssetPicker = {
    mount: mount,
    TABS: TABS,
    fetchTabItems: fetchTabItems,
    normalizeItems: normalizeItems,
    emptyMessage: emptyMessage
  };
})(typeof window !== 'undefined' ? window : this);
