/**
 * Embed Simulator - 嵌入式產品模擬器
 * Build: 2026-06-27
 */

(function() {
  'use strict';
  
  const BUILD = 'embed-simulator-20260627o';
  
  // 訪客上傳槽（主產品／材料／配件由步驟 1、2 選擇自動帶入，不重複上傳）
  const UPLOAD_REF_SLOTS = [
    { key: 'pattern_print', title: '原圖印刷', hint: 'Logo、圖稿等，原樣轉印到產品上' },
    { key: 'pattern_style', title: '風格參考', hint: '參考配色、紋理或設計風格（非 Logo 圖稿）' }
  ];
  
  // === 參考圖上傳限制 ===
  const MAX_REF_IMAGES_TOTAL = 8;
  const MAX_REF_IMAGES_PER_SLOT = 3; // 同 custom-product / product-tree 原型槽上限
  const params = new URLSearchParams(window.location.search);
  const embedId = params.get('embed_id');
  const sig = params.get('sig');
  const useMockData = params.get('mock') === '1'; // ?mock=1 使用假資料
  
  // === 全域狀態 ===
  const state = {
    manufacturer: null,
    prototype: null,                   // 此 iframe 綁定的一款主產品（同看可搭配，無多款列表）
    selectedPrototypeAngles: [],       // image_items 每張圖 = 一格，最多 3 張進生圖
    materials: [],
    parts: [],
    capabilities: [],
    selectedMaterials: [],  // 單選，最多 1 項
    selectedParts: [],      // 可複選
    selectedCapabilities: [],
    selectedCustomCapabilities: [],
    refImages: {},          // 僅訪客上傳：pattern_print、pattern_style
    prompt: '',
    generating: false,
    sessionId: getOrCreateSessionId()
  };
  
  UPLOAD_REF_SLOTS.forEach(function (slot) {
    state.refImages[slot.key] = [];
  });
  
  // === 假資料（測試用）===
  const MOCK_DATA = {
    manufacturer: {
      id: 'mock-mfr-001',
      name: '優質工坊',
      logo_url: 'https://via.placeholder.com/80x80/445D7E/FFFFFF?text=Logo'
    },
    prototype: {
      id: 'proto-001',
      title: '經典後背包',
      image_url: 'https://picsum.photos/seed/matchdo-embed-p1/400/400',
      image_items: [
        { url: 'https://picsum.photos/seed/matchdo-embed-p1/400/400', label: '正面', is_cover: true, link_group: 'black' },
        { url: 'https://picsum.photos/seed/matchdo-embed-p2/400/400', label: '背面', link_group: 'black' },
        { url: 'https://picsum.photos/seed/matchdo-embed-p3/400/400', label: '側面', link_group: 'navy' },
        { url: 'https://picsum.photos/seed/matchdo-embed-p4/400/400', label: '細節', link_group: 'navy' }
      ]
    },
    linkTree: {
      linked_assets: [
        {
          id: 'mat-001',
          title: '帆布',
          image_url: 'https://via.placeholder.com/150x150/F5E6D3/8B4513?text=帆布',
          asset_kind: 'material'
        },
        {
          id: 'mat-002',
          title: '皮革',
          image_url: 'https://via.placeholder.com/150x150/8B4513/FFFFFF?text=皮革',
          asset_kind: 'material'
        },
        {
          id: 'mat-003',
          title: '尼龍',
          image_url: 'https://via.placeholder.com/150x150/1C1C1C/FFFFFF?text=尼龍',
          asset_kind: 'material'
        },
        {
          id: 'part-001',
          title: '金屬扣環',
          image_url: 'https://via.placeholder.com/150x150/C0C0C0/000000?text=扣環',
          asset_kind: 'part'
        },
        {
          id: 'part-002',
          title: '拉鍊頭',
          image_url: 'https://via.placeholder.com/150x150/FFD700/000000?text=拉鍊',
          asset_kind: 'part'
        },
        {
          id: 'part-003',
          title: '肩帶',
          image_url: 'https://via.placeholder.com/150x150/8B4513/FFFFFF?text=肩帶',
          asset_kind: 'part'
        }
      ]
    },
    capabilities: [
      { key: 'embroidery', label: '刺繡' },
      { key: 'printing', label: '絲印' },
      { key: 'hot_stamping', label: '燙金' },
      { key: 'laser', label: '雷射雕刻' }
    ],
    customCapabilities: []
  };
  
  // === Session ID ===
  function getOrCreateSessionId() {
    let sid = localStorage.getItem('embed_session_id');
    if (!sid) {
      sid = 'emb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('embed_session_id', sid);
    }
    return sid;
  }
  
  // === 解析 link-tree API 回應 ===
  function applyLinkTreeData(data) {
    const linked = (data && data.linked_assets) ? data.linked_assets : [];
    state.materials = linked.filter(function (a) { return a.asset_kind === 'material'; });
    state.parts = linked.filter(function (a) { return a.asset_kind === 'part'; });
    // 相容舊格式或 embed API 精簡回傳
    if (data && Array.isArray(data.materials) && data.materials.length) {
      state.materials = data.materials;
    }
    if (data && Array.isArray(data.parts) && data.parts.length) {
      state.parts = data.parts;
    }
    renderMaterials();
    renderParts();
    updateStep2Visibility();
  }
  
  /** bootstrap 只應回傳此 iframe 綁定的一款主產品 */
  function pickBootstrapPrototype(data) {
    if (!data) return null;
    if (data.prototype && data.prototype.id) return data.prototype;
    var list = Array.isArray(data.prototypes) ? data.prototypes : [];
    if (data.prototype_asset_id) {
      var bound = list.find(function (p) { return p && p.id === data.prototype_asset_id; });
      if (bound) return bound;
    }
    if (list.length === 1) return list[0];
    return list.length ? list[0] : null;
  }

  async function initWithPrototype(proto) {
    if (!proto || !proto.id) {
      state.prototype = null;
      renderStep1Prototype();
      return;
    }
    state.prototype = proto;
    syncPrototypeAnglesOnSelect(proto);
    renderStep1Prototype();
    updateStep1Summary();
    renderVendorRefSummary();

    var step2 = document.getElementById('step2');
    if (step2) {
      step2.style.display = '';
      step2.classList.add('expanded');
    }
    var stepRef = document.getElementById('stepRef');
    if (stepRef) stepRef.style.display = '';
    await loadLinkTree(proto.id);
    loadCapabilities(proto.id);
  }

  function updateStep2Visibility() {
    const step2 = document.getElementById('step2');
    const noMat = document.getElementById('noMaterials');
    const hasAny = state.materials.length || state.parts.length;
    if (noMat) {
      noMat.style.display = hasAny ? 'none' : 'block';
    }
    if (step2 && getPrimaryPrototype()) {
      step2.style.display = '';
    }
  }
  
  // === 右下角已選縮圖（主產品＋材配；步驟 2 不重複大圖）===
  function renderSelectedStrip() {
    var el = document.getElementById('simSelectedStrip');
    if (!el) return;
    var thumbs = [];
    if (state.prototype) {
      state.selectedPrototypeAngles.forEach(function (angle) {
        if (!angle || !angle.url) return;
        var t = '主產品';
        if (angle.label) t += ' · ' + angle.label;
        thumbs.push({ url: angle.url, title: t });
      });
    }
    state.selectedMaterials.forEach(function (id) {
      var m = state.materials.find(function (x) { return x.id === id; });
      if (m && m.image_url) thumbs.push({ url: m.image_url, title: '材料 · ' + (m.title || '') });
    });
    state.selectedParts.forEach(function (id) {
      var p = state.parts.find(function (x) { return x.id === id; });
      if (p && p.image_url) thumbs.push({ url: p.image_url, title: '配件 · ' + (p.title || '') });
    });
    if (!thumbs.length) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = thumbs.map(function (it) {
      return '<img class="sim-selected-thumb" src="' + escapeHtml(it.url) + '" alt="" title="' + escapeHtml(it.title) + '">';
    }).join('');
  }

  // === 步驟 2：僅提示材配（主產品已在步驟 1 選過，不重複展示）===
  function renderVendorRefSummary() {
    const el = document.getElementById('vendorRefSummary');
    if (!el) return;
    renderSelectedStrip();

    var hasMatPart = state.selectedMaterials.length > 0 || state.selectedParts.length > 0;
    if (!hasMatPart) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<p class="sim-vendor-ref-hint mb-0">已勾選材料／配件會與步驟 1 主產品一併帶入生圖；右下角可預覽全部已選圖。</p>';
  }
  
  function buildReferencePayload() {
    const referenceSources = [];
    const referenceImages = [];
    
    function pushVendorRef(intent, asset, assetKind) {
      if (!asset || !asset.id) return;
      const url = (asset.image_url || '').trim();
      referenceSources.push({
        intent: intent,
        vendor_asset_id: asset.id,
        asset_kind: assetKind,
        image_url: url || undefined,
        title: asset.title || undefined
      });
      if (url) referenceImages.push(url);
    }
    
    if (state.prototype) {
      const p = state.prototype;
      state.selectedPrototypeAngles.forEach(function (angle) {
        if (!angle || !angle.url) return;
        pushVendorRef('prototype', {
          id: p.id,
          title: p.title,
          image_url: angle.url
        }, 'prototype');
      });
    }
    state.selectedParts.forEach(function (id) {
      pushVendorRef('part', state.parts.find(function (p) { return p.id === id; }), 'part');
    });
    state.selectedMaterials.forEach(function (id) {
      pushVendorRef('material', state.materials.find(function (m) { return m.id === id; }), 'material');
    });
    
    UPLOAD_REF_SLOTS.forEach(function (slot) {
      (state.refImages[slot.key] || []).forEach(function (img) {
        const src = {
          intent: slot.key,
          image_url: img.url,
          pattern_intent: slot.key === 'pattern_style' ? 'style' : 'print'
        };
        referenceSources.push(src);
        referenceImages.push(img.url);
      });
    });
    
    return { referenceSources: referenceSources, referenceImages: referenceImages };
  }
  
  // === 渲染參考圖槽位 ===
  function renderRefSlots() {
    const container = document.getElementById('refSlotsContainer');
    
    container.innerHTML = UPLOAD_REF_SLOTS.map(slot => `
      <div class="sim-ref-slot" data-slot="${slot.key}">
        <div class="sim-ref-slot-header">
          <span class="sim-ref-slot-title">${escapeHtml(slot.title)}</span>
          <span style="font-size: 0.7rem; color: #94a3b8;">
            ${state.refImages[slot.key].length}/${MAX_REF_IMAGES_PER_SLOT}
          </span>
        </div>
        <div class="sim-ref-slot-hint">${escapeHtml(slot.hint)}</div>
        <div class="sim-ref-slot-grid" id="refSlot_${slot.key}"></div>
      </div>
    `).join('');
    
    // 渲染每個槽位的內容
    UPLOAD_REF_SLOTS.forEach(slot => {
      renderRefSlotContent(slot.key);
    });
  }
  
  function renderRefSlotContent(slotKey) {
    const grid = document.getElementById(`refSlot_${slotKey}`);
    if (!grid) return;
    
    const images = state.refImages[slotKey] || [];
    const canAddMore = images.length < MAX_REF_IMAGES_PER_SLOT && countTotalRefImages() < MAX_REF_IMAGES_TOTAL;
    
    let html = '';
    
    // 已上傳的圖片
    images.forEach((img, idx) => {
      html += `
        <div class="sim-ref-thumb">
          <img class="sim-ref-thumb-img" src="${img.url}" alt="">
          <button class="sim-ref-thumb-remove" onclick="window.removeRefImage('${slotKey}', ${idx})">
            <i class="bi bi-x"></i>
          </button>
        </div>
      `;
    });
    
    // 上傳按鈕
    if (canAddMore) {
      html += `
        <label class="sim-ref-upload">
          <input type="file" accept="image/*" onchange="window.handleRefUpload(event, '${slotKey}')">
          <i class="bi bi-plus-lg sim-ref-upload-icon"></i>
        </label>
      `;
    }
    
    grid.innerHTML = html;
    
    // 更新槽位計數
    const slotEl = document.querySelector(`[data-slot="${slotKey}"] .sim-ref-slot-header span:last-child`);
    if (slotEl) {
      slotEl.textContent = `${images.length}/${MAX_REF_IMAGES_PER_SLOT}`;
    }
    
    updateRefSummary();
  }
  
  function countTotalRefImages() {
    let total = 0;
    UPLOAD_REF_SLOTS.forEach(slot => {
      total += (state.refImages[slot.key] || []).length;
    });
    return total;
  }
  
  function updateRefSummary() {
    const total = countTotalRefImages();
    document.getElementById('stepRefCount').textContent = total;
    document.getElementById('stepRef').classList.toggle('has-selection', total > 0);
  }
  
  // === 處理參考圖上傳 ===
  async function handleRefUpload(event, slotKey) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 檢查總數限制
    if (countTotalRefImages() >= MAX_REF_IMAGES_TOTAL) {
      alert(`最多上傳 ${MAX_REF_IMAGES_TOTAL} 張參考圖`);
      return;
    }
    
    // 檢查單槽限制
    if (state.refImages[slotKey].length >= MAX_REF_IMAGES_PER_SLOT) {
      alert(`此類別最多 ${MAX_REF_IMAGES_PER_SLOT} 張`);
      return;
    }
    
    try {
      // 讀取圖片為 DataURL
      const reader = new FileReader();
      reader.onload = (e) => {
        state.refImages[slotKey].push({
          url: e.target.result,
          file: file
        });
        renderRefSlotContent(slotKey);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('[Upload Error]', e);
      alert('上傳失敗，請重試');
    }
  }
  
  // === 移除參考圖 ===
  function removeRefImage(slotKey, index) {
    if (!state.refImages[slotKey]) return;
    state.refImages[slotKey].splice(index, 1);
    renderRefSlotContent(slotKey);
  }
  
  // === 初始化 ===
  function embedErrorMessage(data, fallback) {
    if (!data) return fallback || '操作失敗';
    if (data.error) return data.error;
    return fallback || '操作失敗';
  }

  async function init() {
    console.log('[Embed Simulator]', BUILD);
    
    // 渲染參考圖槽位
    renderRefSlots();
    
    if (useMockData) {
      console.log('[Mock Mode] 使用假資料');
      initWithMockData();
      return;
    }
    
    if (!embedId || !sig) {
      showError('無效的嵌入連結，請檢查 URL 參數');
      return;
    }
    
    try {
      const res = await fetch(`/api/embed/simulator/bootstrap?embed_id=${encodeURIComponent(embedId)}&sig=${encodeURIComponent(sig)}`);
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(embedErrorMessage(data, '載入失敗'));
        return;
      }
      state.manufacturer = data.manufacturer;
      renderHeader();
      await initWithPrototype(pickBootstrapPrototype(data));
    } catch (e) {
      console.error('[Init Error]', e);
      showError('網路錯誤，請稍後再試');
    }
  }
  
  // === Mock 資料初始化 ===
  function initWithMockData() {
    state.manufacturer = MOCK_DATA.manufacturer;
    renderHeader();
    initWithPrototype(MOCK_DATA.prototype);
  }
  
  // === Header 渲染 ===
  function renderHeader() {
    const logo = document.getElementById('simLogo');
    const name = document.getElementById('simVendorName');
    
    logo.src = state.manufacturer.logo_url || '/img/placeholder-logo.png';
    logo.alt = state.manufacturer.name;
    name.textContent = state.manufacturer.name || '廠商';
    document.title = `產品試做 - ${state.manufacturer.name}`;
  }
  
  // === 主產品 image_items：每張圖 = 一個角度（同 product-tree guideTilesForAsset）===
  function getPrototypeImageItems(proto) {
    if (!proto) return [];
    if (Array.isArray(proto.image_items) && proto.image_items.length) {
      var seen = {};
      return proto.image_items.filter(function (it) {
        if (!it || !it.url) return false;
        var u = String(it.url).trim();
        if (!u || seen[u]) return false;
        seen[u] = true;
        return true;
      });
    }
    var cover = (proto.image_url || '').trim();
    return cover ? [{ url: cover, label: '', is_cover: true }] : [];
  }

  function prototypeTileLabel(proto, it, index, total) {
    var raw = (it && it.label) ? String(it.label).trim() : '';
    if (raw) return raw;
    if (total <= 1) return proto.title || '主產品';
    return '角度 ' + (index + 1);
  }

  function isPrototypeAngleSelected(url) {
    if (!url) return false;
    return state.selectedPrototypeAngles.some(function (a) { return a.url === url; });
  }

  /** 僅一張圖時自動帶入該角度；多張圖由使用者自行勾選 */
  function syncPrototypeAnglesOnSelect(proto) {
    var items = getPrototypeImageItems(proto);
    state.selectedPrototypeAngles = [];
    if (items.length === 1) {
      var it = items[0];
      state.selectedPrototypeAngles.push({
        url: it.url,
        label: prototypeTileLabel(proto, it, 0, 1),
        link_group: (it.link_group || '').trim()
      });
    }
  }

  // === Step 1：主產品圖格（同看可搭配 renderGuideCanvas 主產品區，單款無列表）===
  function renderStep1Prototype() {
    var section = document.getElementById('prototypeGuideSection');
    var empty = document.getElementById('prototypeEmpty');
    var heading = document.getElementById('prototypeSectionHeading');
    var grid = document.getElementById('prototypeTileGrid');
    var proto = state.prototype;

    if (!proto) {
      if (section) section.style.display = 'none';
      if (empty) empty.style.display = 'block';
      if (heading) heading.innerHTML = '';
      if (grid) grid.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (section) section.style.display = '';
    if (!heading || !grid) return;

    heading.innerHTML =
      '<span class="sim-guide-tag">主產品</span>' +
      '<span class="sim-guide-name">' + escapeHtml(proto.title || '主產品') + '</span>';

    var items = getPrototypeImageItems(proto);
    grid.innerHTML = items.map(function (it, i) {
      var label = prototypeTileLabel(proto, it, i, items.length);
      var sel = isPrototypeAngleSelected(it.url);
      return (
        '<div class="sim-mat-item sim-angle-item' + (sel ? ' selected' : '') + '" role="listitem" tabindex="0" aria-pressed="' + (sel ? 'true' : 'false') + '" title="' + escapeHtml(label) + '">' +
        '<img class="sim-mat-img" src="' + escapeHtml(it.url) + '" alt="' + escapeHtml(label) + '">' +
        '<i class="sim-mat-checkmark bi bi-check" aria-hidden="true"></i>' +
        '<span class="sim-angle-label">' + escapeHtml(label) + '</span>' +
        '</div>'
      );
    }).join('');

    grid.querySelectorAll('.sim-angle-item').forEach(function (el, i) {
      var it = items[i];
      var label = prototypeTileLabel(proto, it, i, items.length);
      el.addEventListener('click', function () {
        togglePrototypeTile(it.url, label);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });
  }
  
  function getPrimaryPrototype() {
    return state.prototype || null;
  }
  
  function updateStep1Summary() {
    const step1 = document.getElementById('step1');
    const proto = state.prototype;
    const picked = state.selectedPrototypeAngles.length;
    step1.classList.toggle('has-selection', picked > 0);
    const el = document.getElementById('step1SelectedName');
    if (!proto) {
      el.textContent = '—';
      renderSelectedStrip();
      return;
    }
    if (!picked) {
      el.textContent = (proto.title || '主產品') + ' · 請點圖選取';
      renderSelectedStrip();
      return;
    }
    if (picked === 1) {
      el.textContent = proto.title || '主產品';
    } else {
      el.textContent = (proto.title || '主產品') + ' · ' + picked + ' 張';
    }
    renderSelectedStrip();
  }

  function togglePrototypeTile(url, label) {
    if (!url || !state.prototype) return;
    var items = getPrototypeImageItems(state.prototype);
    if (items.length <= 1) return;
    var labelFor = function (it) {
      var idx = items.findIndex(function (x) { return x && x.url === it.url; });
      return prototypeTileLabel(state.prototype, it, idx >= 0 ? idx : 0, items.length);
    };
    var result;
    if (typeof MatchdoImageLinkGroups !== 'undefined') {
      result = MatchdoImageLinkGroups.toggleLinkedPrototypePick(
        items,
        state.selectedPrototypeAngles,
        url,
        { maxSelect: MAX_REF_IMAGES_PER_SLOT, labelForItem: labelFor }
      );
    } else {
      var list = state.selectedPrototypeAngles.slice();
      var idx = list.findIndex(function (a) { return a.url === url; });
      if (idx >= 0) {
        list.splice(idx, 1);
        result = { selected: list, action: 'remove' };
      } else if (list.length >= MAX_REF_IMAGES_PER_SLOT) {
        alert('主產品參考圖最多選 ' + MAX_REF_IMAGES_PER_SLOT + ' 張（與看可搭配／設計頁原型槽相同）');
        return;
      } else {
        list.push({ url: url, label: label || '' });
        result = { selected: list, action: 'add' };
      }
    }
    if (result.action === 'blocked' && result.reason === 'max') {
      alert('主產品參考圖最多選 ' + MAX_REF_IMAGES_PER_SLOT + ' 張（與看可搭配／設計頁原型槽相同）');
      return;
    }
    if (result.truncated) {
      alert('主產品參考圖最多選 ' + MAX_REF_IMAGES_PER_SLOT + ' 張；同組部分角度未能全部加入');
    }
    state.selectedPrototypeAngles = result.selected;
    renderStep1Prototype();
    updateStep1Summary();
    renderVendorRefSummary();
  }
  
  // === 載入材配樹 ===
  async function loadLinkTree(protoId) {
    if (useMockData) {
      applyLinkTreeData(MOCK_DATA.linkTree);
      return;
    }
    
    try {
      let res = await fetch('/api/embed/simulator/link-tree?embed_id=' + encodeURIComponent(embedId) +
        '&sig=' + encodeURIComponent(sig) + '&prototype_asset_id=' + encodeURIComponent(protoId));
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        console.warn('[Link Tree]', embedErrorMessage(data, 'HTTP ' + res.status));
        applyLinkTreeData({ linked_assets: [] });
        return;
      }
      applyLinkTreeData(data);
    } catch (e) {
      console.warn('[Link Tree Error]', e);
      applyLinkTreeData({ linked_assets: [] });
    }
  }
  
  // === Step 2: 材料渲染 ===
  function renderMaterials() {
    const section = document.getElementById('materialSection');
    const list = document.getElementById('materialList');
    const noMat = document.getElementById('noMaterials');
    
    if (!state.materials.length) {
      section.style.display = 'none';
      noMat.style.display = state.parts.length ? 'none' : 'block';
      return;
    }
    
    section.style.display = 'block';
    noMat.style.display = 'none';
    
    list.innerHTML = state.materials.map(m => `
      <div class="sim-mat-item" data-id="${m.id}">
        <img class="sim-mat-img" src="${m.image_url}" alt="${escapeHtml(m.title)}">
        <i class="sim-mat-checkmark bi bi-check"></i>
      </div>
    `).join('');
    
    // 綁定點擊事件
    list.querySelectorAll('.sim-mat-item').forEach(item => {
      item.addEventListener('click', () => {
        const matId = item.dataset.id;
        selectMaterial(matId);
      });
    });
  }
  
  // === 選擇材料（單選）===
  function selectMaterial(matId) {
    // 單選：清空後選中
    state.selectedMaterials = [matId];
    
    document.querySelectorAll('#materialList .sim-mat-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === matId);
    });
    
    updateStep2Summary();
    renderVendorRefSummary();
  }
  
  // === Step 2: 配件渲染 ===
  function renderParts() {
    const section = document.getElementById('partSection');
    const list = document.getElementById('partList');
    
    if (!state.parts.length) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    list.innerHTML = state.parts.map(p => `
      <div class="sim-mat-item" data-id="${p.id}">
        <img class="sim-mat-img" src="${p.image_url}" alt="${escapeHtml(p.title)}">
        <i class="sim-mat-checkmark bi bi-check"></i>
      </div>
    `).join('');
    
    // 綁定點擊事件
    list.querySelectorAll('.sim-mat-item').forEach(item => {
      item.addEventListener('click', () => {
        const partId = item.dataset.id;
        togglePart(partId);
      });
    });
  }
  
  // === 切換配件（複選）===
  function togglePart(partId) {
    const idx = state.selectedParts.indexOf(partId);
    if (idx >= 0) {
      state.selectedParts.splice(idx, 1);
    } else {
      state.selectedParts.push(partId);
    }
    
    document.querySelector('#partList [data-id="' + partId + '"]').classList.toggle('selected');
    updateStep2Summary();
    renderVendorRefSummary();
  }
  
  // === 更新 Step 2 摘要 ===
  function updateStep2Summary() {
    const count = state.selectedMaterials.length + state.selectedParts.length;
    document.getElementById('step2Count').textContent = count;
    document.getElementById('step2').classList.toggle('has-selection', count > 0);
  }
  
  // === 載入工藝選項 ===
  async function loadCapabilities(protoId) {
    if (useMockData) {
      state.capabilities = MOCK_DATA.capabilities;
      state.customCapabilities = MOCK_DATA.customCapabilities || [];
      renderCapabilities();
      return;
    }
    
    try {
      const res = await fetch('/api/embed/simulator/capabilities?embed_id=' + encodeURIComponent(embedId) +
        '&sig=' + encodeURIComponent(sig) + '&prototype_asset_id=' + encodeURIComponent(protoId));
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        console.warn('[Capabilities]', embedErrorMessage(data, 'HTTP ' + res.status));
        state.capabilities = [];
        state.customCapabilities = [];
        renderCapabilities();
        return;
      }
      state.capabilities = data.capabilities || [];
      state.customCapabilities = data.custom_labels || [];
      
      renderCapabilities();
    } catch (e) {
      console.warn('[Capabilities Error]', e);
    }
  }
  
  // === Step 3: 工藝渲染（預設全選，同 custom-product.html）===
  function renderCapabilities() {
    const caps = state.capabilities || [];
    const customs = state.customCapabilities || [];
    if (!caps.length && !customs.length) {
      document.getElementById('step3').style.display = 'none';
      state.selectedCapabilities = [];
      state.selectedCustomCapabilities = [];
      return;
    }
    
    const step3 = document.getElementById('step3');
    step3.style.display = '';
    
    // 預設全選
    state.selectedCapabilities = caps.map(c => c.key).filter(Boolean);
    state.selectedCustomCapabilities = customs.map(c => c.label).filter(Boolean);
    
    const options = document.getElementById('capabilityOptions');
    let html = caps.map(c => `
      <label class="sim-cap-checkbox">
        <input type="checkbox" value="${escapeHtml(c.key)}" checked>
        <span>${escapeHtml(c.label || c.key)}</span>
      </label>
    `).join('');
    
    html += customs.map(c => `
      <label class="sim-cap-checkbox">
        <input type="checkbox" value="custom:${escapeHtml(c.label)}" data-custom="1" checked>
        <span>${escapeHtml(c.label)} <span style="color:#94a3b8;font-size:0.75rem">(自填)</span></span>
      </label>
    `).join('');
    
    options.innerHTML = html;
    
    options.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => syncCapabilitiesFromDom());
    });
    
    updateCapabilitySummary();
  }
  
  function syncCapabilitiesFromDom() {
    const keys = [];
    const customs = [];
    document.querySelectorAll('#capabilityOptions input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) return;
      if (cb.dataset.custom === '1') {
        const lbl = cb.value.replace(/^custom:/, '');
        if (lbl) customs.push(lbl);
      } else if (cb.value) {
        keys.push(cb.value);
      }
    });
    state.selectedCapabilities = keys;
    state.selectedCustomCapabilities = customs;
    updateCapabilitySummary();
  }
  
  function updateCapabilitySummary() {
    const count = state.selectedCapabilities.length + (state.selectedCustomCapabilities || []).length;
    document.getElementById('step3Count').textContent = count;
    document.getElementById('step3').classList.toggle('has-selection', count > 0);
  }
  
  // === Step 5: 生成 ===
  async function handleGenerate() {
    if (state.generating) return;
    
    if (!state.prototype) {
      alert('請選擇主產品');
      return;
    }

    var protoItems = getPrototypeImageItems(state.prototype);
    if (protoItems.length > 1 && !state.selectedPrototypeAngles.length) {
      alert('請點選要帶入生圖的主產品參考圖（最多 3 張，與看可搭配相同）');
      document.getElementById('step1').classList.add('expanded');
      return;
    }
    
    state.prompt = document.getElementById('simPrompt').value.trim();
    
    const btn = document.getElementById('btnGenerate');
    const status = document.getElementById('generateStatus');
    const error = document.getElementById('generateError');
    
    btn.disabled = true;
    status.style.display = 'flex';
    error.style.display = 'none';
    state.generating = true;
    
    try {
      if (useMockData) {
        // Mock 生成
        await mockGenerate();
      } else {
        await realGenerate();
      }
    } catch (e) {
      error.textContent = e.message;
      error.style.display = 'block';
    } finally {
      btn.disabled = false;
      status.style.display = 'none';
      state.generating = false;
    }
  }
  
  // === 真實生成 ===
  async function realGenerate() {
    const refs = buildReferencePayload();
    const primary = getPrimaryPrototype();
    const payload = {
      embed_id: embedId,
      sig: sig,
      prototype_asset_id: primary.id,
      prototype_angle_urls: state.selectedPrototypeAngles.map(function (a) { return a.url; }),
      material_ids: state.selectedMaterials,
      part_ids: state.selectedParts,
      capability_keys: state.selectedCapabilities,
      capability_custom_labels: state.selectedCustomCapabilities || [],
      reference_sources: refs.referenceSources,
      reference_images: refs.referenceImages,
      prompt: state.prompt,
      session_id: state.sessionId
    };
    
    const res = await fetch('/api/embed/simulator/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json().catch(function () { return {}; });
    
    if (!res.ok) {
      const code = data.error_code || '';
      if (code === 'daily_cap_reached' || code === 'monthly_cap_reached' || code === 'rate_limit_ip_hour') {
        throw new Error(data.error || '試做次數已達上限，請稍後再試');
      }
      if (code === 'insufficient_credits' || code === 'plan_quota_exhausted_no_credits') {
        throw new Error(data.error || '試做暫停，請聯絡廠商');
      }
      throw new Error(embedErrorMessage(data, '生成失敗'));
    }
    
    showResult(data.imageUrl);
  }
  
  // === Mock 生成（測試用）===
  async function mockGenerate() {
    // 模擬 3 秒延遲
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 顯示假成圖
    const mockImageUrl = 'https://via.placeholder.com/1024x1024/445D7E/FFFFFF?text=Generated+Design';
    showResult(mockImageUrl);
  }
  
  // === 顯示結果 ===
  function showResult(imageUrl) {
    // 顯示結果區
    const section = document.getElementById('resultSection');
    section.style.display = 'block';
    
    // 隱藏 placeholder、顯示成圖
    document.getElementById('resultPlaceholder').style.display = 'none';
    const content = document.getElementById('resultContent');
    content.style.display = 'block';
    
    const img = document.getElementById('resultImg');
    img.src = imageUrl;
    
    const dl = document.getElementById('resultDownload');
    dl.href = imageUrl;
    dl.download = `matchdo-design-${Date.now()}.jpg`;
    
    // 捲動到結果區
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
  
  // === 再生成 ===
  function handleRegenerate() {
    // 再生成 = 再呼叫一次 generate（計額度）
    handleGenerate();
  }
  
  // === 切換 Step 展開／收起 ===
  function toggleStep(stepNum) {
    const step = document.getElementById(stepNum === 'ref' ? 'stepRef' : `step${stepNum}`);
    if (step) {
      step.classList.toggle('expanded');
    }
  }
  
  // === 錯誤顯示 ===
  function showError(msg) {
    const container = document.querySelector('.sim-container');
    container.innerHTML = `
      <div class="sim-error" style="margin: 2rem 0;">
        <strong>載入失敗</strong><br>
        ${escapeHtml(msg)}
      </div>
    `;
  }
  
  // === HTML Escape ===
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  // === 匯出到 window（給 HTML onclick 用）===
  window.toggleStep = toggleStep;
  window.handleGenerate = handleGenerate;
  window.handleRegenerate = handleRegenerate;
  window.handleRefUpload = handleRefUpload;
  window.removeRefImage = removeRefImage;
  
  // === 啟動 ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
