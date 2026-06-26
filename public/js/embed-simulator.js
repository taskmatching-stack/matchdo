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
    prompt: '',
    generating: false,
    sessionId: getOrCreateSessionId()
  };
  
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
    ]
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
  
  // === 初始化 ===
  async function init() {
    console.log('[Embed Simulator]', BUILD);
    
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
      // Mock 資料
      state.capabilities = MOCK_DATA.capabilities;
      renderCapabilities();
      return;
    }
    
    try {
      const res = await fetch(`/api/embed/simulator/capabilities?embed_id=${embedId}&sig=${sig}&prototype_asset_id=${protoId}`);
      const data = await res.json();
      state.capabilities = data.capabilities || [];
      
      renderCapabilities();
    } catch (e) {
      console.warn('[Capabilities Error]', e);
    }
  }
  
  // === Step 3: 工藝渲染 ===
  function renderCapabilities() {
    if (!state.capabilities.length) return;
    
    const step3 = document.getElementById('step3');
    step3.style.display = '';
    
    const options = document.getElementById('capabilityOptions');
    options.innerHTML = state.capabilities.map(c => `
      <label class="sim-cap-checkbox">
        <input type="checkbox" value="${c.key}">
        <span>${escapeHtml(c.label)}</span>
      </label>
    `).join('');
    
    // 綁定變更事件
    options.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        toggleCapability(cb.value);
      });
    });
  }
  
  // === 切換工藝 ===
  function toggleCapability(key) {
    const idx = state.selectedCapabilities.indexOf(key);
    if (idx >= 0) {
      state.selectedCapabilities.splice(idx, 1);
    } else {
      state.selectedCapabilities.push(key);
    }
    
    document.getElementById('step3Count').textContent = state.selectedCapabilities.length;
    document.getElementById('step3').classList.toggle('has-selection', state.selectedCapabilities.length > 0);
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
    const payload = {
      embed_id: embedId,
      sig: sig,
      prototype_asset_id: state.selectedPrototype.id,
      material_ids: state.selectedMaterials,
      part_ids: state.selectedParts,
      capability_keys: state.selectedCapabilities,
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
    const step = document.getElementById(`step${stepNum}`);
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
  
  // === 啟動 ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
