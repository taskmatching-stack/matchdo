/**
 * Embed Simulator - 嵌入式產品模擬器
 * Build: 2026-06-27
 */

(function() {
  'use strict';
  
  const BUILD = 'embed-simulator-20260627';
  
  // === URL 參數 ===
  const params = new URLSearchParams(window.location.search);
  const embedId = params.get('embed_id');
  const sig = params.get('sig');
  const useMockData = params.get('mock') === '1'; // ?mock=1 使用假資料
  
  // === 全域狀態 ===
  const state = {
    manufacturer: null,
    prototypes: [],
    selectedPrototype: null,
    materials: [],
    parts: [],
    capabilities: [],
    selectedMaterials: [],  // 單選，最多 1 項
    selectedParts: [],      // 可複選
    selectedCapabilities: [],
    selectedCustomCapabilities: [],
    refImages: {},          // { prototype: [], material: [], part: [], pattern_print: [], pattern_style: [] }
    prompt: '',
    generating: false,
    sessionId: getOrCreateSessionId()
  };
  
  // === 參考圖槽位定義 ===
  const MAX_REF_IMAGES_TOTAL = 8;
  const MAX_REF_IMAGES_PER_SLOT = 3;
  const REF_SLOTS = [
    { key: 'prototype', title: '主體原型', hint: '幾何結構與尺寸' },
    { key: 'material', title: '主體材料', hint: '表面面料、皮革' },
    { key: 'part', title: '配件／零件', hint: '五金、拉鍊、掛繩' },
    { key: 'pattern_print', title: '原圖印刷', hint: '圖稿原樣轉印' },
    { key: 'pattern_style', title: '風格參考', hint: '參考風格設計表面' }
  ];
  
  // 初始化參考圖狀態
  REF_SLOTS.forEach(slot => {
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
      materials: [
        {
          id: 'mat-001',
          title: '帆布',
          image_url: 'https://via.placeholder.com/150x150/F5E6D3/8B4513?text=帆布'
        },
        {
          id: 'mat-002',
          title: '皮革',
          image_url: 'https://via.placeholder.com/150x150/8B4513/FFFFFF?text=皮革'
        },
        {
          id: 'mat-003',
          title: '尼龍',
          image_url: 'https://via.placeholder.com/150x150/1C1C1C/FFFFFF?text=尼龍'
        }
      ],
      parts: [
        {
          id: 'part-001',
          title: '金屬扣環',
          image_url: 'https://via.placeholder.com/150x150/C0C0C0/000000?text=扣環'
        },
        {
          id: 'part-002',
          title: '拉鍊頭',
          image_url: 'https://via.placeholder.com/150x150/FFD700/000000?text=拉鍊'
        },
        {
          id: 'part-003',
          title: '肩帶',
          image_url: 'https://via.placeholder.com/150x150/8B4513/FFFFFF?text=肩帶'
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
  
  // === 渲染參考圖槽位 ===
  function renderRefSlots() {
    const container = document.getElementById('refSlotsContainer');
    
    container.innerHTML = REF_SLOTS.map(slot => `
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
    REF_SLOTS.forEach(slot => {
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
    REF_SLOTS.forEach(slot => {
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
      
      // 單款自動選中
      if (state.prototypes.length === 1) {
        selectPrototype(state.prototypes[0]);
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
      grid.innerHTML = '<p class="sim-no-data">暫無產品款式</p>';
      return;
    }
    
    grid.innerHTML = state.prototypes.map(p => `
      <div class="sim-proto-card" data-id="${p.id}">
        <img class="sim-proto-img" src="${p.image_url || '/img/placeholder.png'}" alt="${escapeHtml(p.title)}">
        <div class="sim-proto-name">${escapeHtml(p.title || '款式')}</div>
      </div>
    `).join('');
    
    // 綁定點擊事件
    grid.querySelectorAll('.sim-proto-card').forEach(card => {
      card.addEventListener('click', () => {
        const protoId = card.dataset.id;
        const proto = state.prototypes.find(p => p.id === protoId);
        if (proto) selectPrototype(proto);
      });
    });
  }
  
  // === 選擇原型 ===
  async function selectPrototype(proto) {
    state.selectedPrototype = proto;
    
    // UI 更新
    document.querySelectorAll('.sim-proto-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === proto.id);
    });
    
    const step1 = document.getElementById('step1');
    step1.classList.add('has-selection');
    document.getElementById('step1SelectedName').textContent = proto.title;
    
    // 收起 Step 1（若有多款）
    if (state.prototypes.length > 1) {
      step1.classList.remove('expanded');
    }
    
    // 載入材配 + 工藝
    await loadLinkTree(proto.id);
    loadCapabilities(proto.id);
    
    // 展開 Step 2（若有材配）
    if (state.materials.length || state.parts.length) {
      const step2 = document.getElementById('step2');
      step2.style.display = '';
      step2.classList.add('expanded');
    }
  }
  
  // === 載入材配樹 ===
  async function loadLinkTree(protoId) {
    if (useMockData) {
      // Mock 資料
      state.materials = MOCK_DATA.linkTree.materials;
      state.parts = MOCK_DATA.linkTree.parts;
      renderMaterials();
      renderParts();
      return;
    }
    
    try {
      const res = await fetch(`/api/embed/simulator/link-tree?embed_id=${embedId}&sig=${sig}&prototype_asset_id=${protoId}`);
      const data = await res.json();
      state.materials = data.materials || [];
      state.parts = data.parts || [];
      
      renderMaterials();
      renderParts();
    } catch (e) {
      console.warn('[Link Tree Error]', e);
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
    
    document.querySelector(`#partList [data-id="${partId}"]`).classList.toggle('selected');
    updateStep2Summary();
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
    
    if (!state.selectedPrototype) {
      alert('請先選擇款式');
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
    // 準備參考圖（轉成 base64 或 URL）
    const refImagesPayload = {};
    REF_SLOTS.forEach(slot => {
      const images = state.refImages[slot.key] || [];
      if (images.length > 0) {
        refImagesPayload[slot.key] = images.map(img => ({
          url: img.url,  // DataURL (base64)
          filename: img.file ? img.file.name : 'image.jpg'
        }));
      }
    });
    
    const payload = {
      embed_id: embedId,
      sig: sig,
      prototype_asset_id: state.selectedPrototype.id,
      material_ids: state.selectedMaterials,
      part_ids: state.selectedParts,
      capability_keys: state.selectedCapabilities,
      capability_custom_labels: state.selectedCustomCapabilities || [],
      ref_images: refImagesPayload,
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
