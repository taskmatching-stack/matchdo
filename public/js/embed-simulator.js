/**
 * Embed Simulator - 嵌入式產品模擬器
 * Build: 2026-06-27
 */

(function() {
  'use strict';
  
  const BUILD = 'embed-simulator-20260627e';
  
  // 訪客上傳槽（主產品／材料／配件由步驟 1、2 選擇自動帶入，不重複上傳）
  const UPLOAD_REF_SLOTS = [
    { key: 'pattern_print', title: '原圖印刷', hint: 'Logo、圖稿等，原樣轉印到產品上' },
    { key: 'pattern_style', title: '風格參考', hint: '參考配色、紋理或設計風格（非 Logo 圖稿）' }
  ];
  
  // === 參考圖上傳限制 ===
  const MAX_REF_IMAGES_TOTAL = 8;
  const MAX_REF_IMAGES_PER_SLOT = 3;
  const MAX_PROTOTYPE_SELECT = 3; // 同 custom-product 原型槽上限
  const params = new URLSearchParams(window.location.search);
  const embedId = params.get('embed_id');
  const sig = params.get('sig');
  const useMockData = params.get('mock') === '1'; // ?mock=1 使用假資料
  
  // === 全域狀態 ===
  const state = {
    manufacturer: null,
    prototypes: [],
    selectedPrototypes: [],  // 可複選，最多 3 個主產品（不同角度參考）
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
    prototypes: [
      {
        id: 'proto-001',
        title: '經典後背包',
        image_url: 'https://via.placeholder.com/300x300/E8ECF0/445D7E?text=後背包'
      },
      {
        id: 'proto-002',
        title: '休閒側背包',
        image_url: 'https://via.placeholder.com/300x300/F0F4F8/445D7E?text=側背包'
      },
      {
        id: 'proto-003',
        title: '輕巧手提包',
        image_url: 'https://via.placeholder.com/300x300/F8FAFC/445D7E?text=手提包'
      },
      {
        id: 'proto-004',
        title: '多功能腰包',
        image_url: 'https://via.placeholder.com/300x300/E0E7EE/445D7E?text=腰包'
      }
    ],
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
  
  // === 廠商來源圖摘要（步驟 1、2 自動帶入，非上傳）===
  function renderVendorRefSummary() {
    const el = document.getElementById('vendorRefSummary');
    if (!el) return;
    
    const items = [];
    state.selectedPrototypes.forEach(function (p) {
      items.push({
        tag: '主產品',
        title: p.title || '主產品',
        url: p.image_url
      });
    });
    state.selectedMaterials.forEach(function (id) {
      const m = state.materials.find(function (x) { return x.id === id; });
      if (m) items.push({ tag: '材料', title: m.title || '材料', url: m.image_url });
    });
    state.selectedParts.forEach(function (id) {
      const p = state.parts.find(function (x) { return x.id === id; });
      if (p) items.push({ tag: '配件', title: p.title || '配件', url: p.image_url });
    });
    
    if (!items.length) {
      el.innerHTML = '<p class="sim-vendor-ref-hint">選取主產品後，其圖片會自動作為生圖參考。</p>';
      return;
    }
    
    el.innerHTML =
      '<p class="sim-vendor-ref-hint">以下由步驟 1、2 勾選的廠商素材自動帶入生圖，無需重複上傳。</p>' +
      '<div class="sim-vendor-ref-grid">' +
      items.map(function (it) {
        return '<div class="sim-vendor-ref-item">' +
          '<img src="' + (it.url || '/img/placeholder.png') + '" alt="">' +
          '<span class="sim-vendor-ref-tag">' + escapeHtml(it.tag) + '</span>' +
          '<span class="sim-vendor-ref-name">' + escapeHtml(it.title) + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
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
    
    state.selectedPrototypes.forEach(function (p) {
      pushVendorRef('prototype', p, 'prototype');
    });
    state.selectedMaterials.forEach(function (id) {
      pushVendorRef('material', state.materials.find(function (m) { return m.id === id; }), 'material');
    });
    state.selectedParts.forEach(function (id) {
      pushVendorRef('part', state.parts.find(function (p) { return p.id === id; }), 'part');
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
      const res = await fetch(`/api/embed/simulator/bootstrap?embed_id=${embedId}&sig=${sig}`);
      if (!res.ok) {
        const err = await res.json();
        showError(err.error || '載入失敗');
        return;
      }
      const data = await res.json();
      state.manufacturer = data.manufacturer;
      state.prototypes = data.prototypes || [];
      
      renderHeader();
      renderPrototypes();
      
      // 僅一款時自動選中
      if (state.prototypes.length === 1) {
        togglePrototype(state.prototypes[0]);
      }
    } catch (e) {
      console.error('[Init Error]', e);
      showError('網路錯誤，請稍後再試');
    }
  }
  
  // === Mock 資料初始化 ===
  function initWithMockData() {
    state.manufacturer = MOCK_DATA.manufacturer;
    state.prototypes = MOCK_DATA.prototypes;
    
    renderHeader();
    renderPrototypes();
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
  
  // === Step 1: 原型列表 ===
  function renderPrototypes() {
    const grid = document.getElementById('prototypeGrid');
    
    if (!state.prototypes.length) {
      grid.innerHTML = '<p class="sim-no-data">暫無主產品</p>';
      return;
    }
    
    grid.innerHTML = state.prototypes.map(function (p) {
      const sel = isPrototypeSelected(p.id);
      return (
        '<div class="sim-proto-card' + (sel ? ' selected' : '') + '" data-id="' + p.id + '" role="button" tabindex="0" aria-pressed="' + (sel ? 'true' : 'false') + '" aria-label="' + escapeHtml(p.title || '主產品') + '">' +
        '<img class="sim-proto-img" src="' + (p.image_url || '/img/placeholder.png') + '" alt="' + escapeHtml(p.title) + '">' +
        '<i class="sim-mat-checkmark bi bi-check" aria-hidden="true"></i>' +
        '<div class="sim-proto-name">' + escapeHtml(p.title || '主產品') + '</div>' +
        '</div>'
      );
    }).join('');
    
    grid.querySelectorAll('.sim-proto-card').forEach(function (card) {
      card.addEventListener('click', function () {
        const proto = state.prototypes.find(function (x) { return x.id === card.dataset.id; });
        if (proto) togglePrototype(proto);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
    
    syncPrototypeCardUI();
  }
  
  function getPrimaryPrototype() {
    return state.selectedPrototypes.length ? state.selectedPrototypes[0] : null;
  }
  
  function isPrototypeSelected(id) {
    return state.selectedPrototypes.some(function (p) { return p.id === id; });
  }
  
  function syncPrototypeCardUI() {
    document.querySelectorAll('.sim-proto-card').forEach(function (el) {
      const sel = isPrototypeSelected(el.dataset.id);
      el.classList.toggle('selected', sel);
      el.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
  }
  
  function updateStep1Summary() {
    const step1 = document.getElementById('step1');
    const count = state.selectedPrototypes.length;
    step1.classList.toggle('has-selection', count > 0);
    const el = document.getElementById('step1SelectedName');
    if (!count) {
      el.textContent = '—';
      return;
    }
    if (count === 1) {
      el.textContent = state.selectedPrototypes[0].title || '1 個主產品';
    } else {
      el.textContent = count + ' 個主產品';
    }
  }
  
  function hideStepsAfterPrototypeClear() {
    ['step2', 'step3', 'stepRef'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    state.selectedMaterials = [];
    state.selectedParts = [];
    state.capabilities = [];
    state.customCapabilities = [];
    state.selectedCapabilities = [];
    state.selectedCustomCapabilities = [];
    document.getElementById('capabilityOptions').innerHTML = '';
  }
  
  async function reloadPrimaryPrototypeContext() {
    const primary = getPrimaryPrototype();
    if (!primary) return;
    state.selectedMaterials = [];
    state.selectedParts = [];
    await loadLinkTree(primary.id);
    loadCapabilities(primary.id);
    updateStep2Summary();
    renderVendorRefSummary();
  }
  
  async function onFirstPrototypeSelected(proto) {
    const step2 = document.getElementById('step2');
    step2.style.display = '';
    step2.classList.add('expanded');
    const stepRef = document.getElementById('stepRef');
    if (stepRef) stepRef.style.display = '';
    await loadLinkTree(proto.id);
    loadCapabilities(proto.id);
  }
  
  async function addPrototype(proto) {
    if (isPrototypeSelected(proto.id)) return;
    if (state.selectedPrototypes.length >= MAX_PROTOTYPE_SELECT) {
      alert('最多選取 ' + MAX_PROTOTYPE_SELECT + ' 個主產品（可作不同角度參考）');
      return;
    }
    const isFirst = !state.selectedPrototypes.length;
    state.selectedPrototypes.push(proto);
    if (isFirst) {
      await onFirstPrototypeSelected(proto);
    }
    updateStep1Summary();
    renderVendorRefSummary();
    // 步驟 1 保持展開，方便繼續勾選
    document.getElementById('step1').classList.add('expanded');
  }
  
  async function removePrototype(proto) {
    const idx = state.selectedPrototypes.findIndex(function (p) { return p.id === proto.id; });
    if (idx < 0) return;
    const wasPrimary = getPrimaryPrototype() && getPrimaryPrototype().id === proto.id;
    state.selectedPrototypes.splice(idx, 1);
    if (!state.selectedPrototypes.length) {
      hideStepsAfterPrototypeClear();
    } else if (wasPrimary) {
      await reloadPrimaryPrototypeContext();
    }
    updateStep1Summary();
    renderVendorRefSummary();
  }
  
  async function togglePrototype(proto) {
    if (isPrototypeSelected(proto.id)) {
      await removePrototype(proto);
    } else {
      await addPrototype(proto);
    }
    syncPrototypeCardUI();
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
      if (!res.ok) {
        // 後端 embed API 尚未就緒時，fallback 公開 link-tree
        res = await fetch('/api/vendor-assets/' + encodeURIComponent(protoId) + '/link-tree');
      }
      if (!res.ok) {
        applyLinkTreeData({ linked_assets: [] });
        return;
      }
      const data = await res.json();
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
      const res = await fetch(`/api/embed/simulator/capabilities?embed_id=${embedId}&sig=${sig}&prototype_asset_id=${protoId}`);
      const data = await res.json();
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
    
    if (!state.selectedPrototypes.length) {
      alert('請至少選取一個主產品');
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
      prototype_asset_ids: state.selectedPrototypes.map(function (p) { return p.id; }),
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
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || '生成失敗');
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
