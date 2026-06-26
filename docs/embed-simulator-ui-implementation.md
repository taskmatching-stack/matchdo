# Embed Simulator UI 實作指南（2026-06-27）

> 搭配 [`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md) 使用，本文件專注於**前端 UI 如何做**。

## 設計原則

**單欄 Accordion 通用版**：桌機、手機、平板使用**同一套佈局**，容器限寬 640px 置中，全部垂直堆疊。

**優勢**：
- 簡單易維護（無 RWD 左右欄切換）
- 桌機手機一致（訪客體驗統一）
- iframe 嵌入更穩定（不會因螢幕寬度產生佈局斷裂）

---

## 1. 佈局架構（Wireframe）— 桌機手機通用單欄

**設計原則**：桌機、手機、平板使用**同一套 Accordion 版面**，簡單、穩定、易維護。

```
┌─────────────────────────────────────────┐
│ [Logo] 廠商名稱      Powered by Matchdo │ ← header (60px)
├─────────────────────────────────────────┤
│                                         │
│ ① 選擇款式 ▼                            │ ← Step 1（預設展開）
│ ┌─────┐ ┌─────┐ ┌─────┐                │
│ │ 軍綠 │ │ 黑色 │ │ 咖啡 │  (卡片 grid) │
│ └─────┘ └─────┘ └─────┘                │
│ ▸ 已選：軍綠後背包                       │ ← 收起時顯示摘要
│                                         │
├─────────────────────────────────────────┤
│ ② 材料與配件（選填）▼                    │ ← Step 2（選完原型後顯示）
│ [材料 grid + 配件 grid]                 │
│ ▸ 已選 2 項                             │
│                                         │
├─────────────────────────────────────────┤
│ ③ 表面工藝（選填）▼                      │ ← Step 3
│ □ 絲印  □ 燙金  □ 雷射                  │
│ ▸ 已選 1 項                             │
│                                         │
├─────────────────────────────────────────┤
│ ④ 描述你想要的產品 ▼                     │ ← Step 4（預設展開）
│ ┌─────────────────────────────────────┐ │
│ │ 軍綠色，正面印白色 LOGO…             │ │
│ └─────────────────────────────────────┘ │
│ 提示：有參考圖時可簡短描述…              │
│                                         │
├─────────────────────────────────────────┤
│         [立即生成]  ←                    │ ← Step 5（固定展開）
│       (生成中…⏳)                        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│         [生成結果圖]                     │ ← 結果區（生成後顯示）
│    ┌─────────────────────┐             │
│    │                     │             │
│    │   1024×1024 成圖    │             │
│    │                     │             │
│    └─────────────────────┘             │
│   [再生成] [下載]                        │
│                                         │
├─────────────────────────────────────────┤
│         Powered by Matchdo              │ ← footer (可選)
└─────────────────────────────────────────┘
```

**佈局說明**：
- **容器寬度**：桌機 max-width: 640px 置中；手機 100% 寬
- **Accordion**：每個 Step 可獨立展開／收起
- **結果圖**：插在「立即生成」按鈕下方，桌機手機同位置
- **無左右欄**：全部垂直堆疊，捲動流暢

---

## 2. HTML 結構（完整範例）

### 2.1 檔案：`public/embed/simulator.html`

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <title>產品試做 - {廠商名}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/img/favicon.ico">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">
  <link href="/css/bootstrap.min.css" rel="stylesheet">
  <style>
    /* === 全域 === */
    :root {
      --sim-primary: #445D7E;
      --sim-dark: #2d4059;
      --sim-border: rgba(68, 93, 126, 0.15);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100vh; background: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    
    /* === Header === */
    .sim-header {
      background: #fff; border-bottom: 1px solid var(--sim-border);
      padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem;
    }
    .sim-logo { width: 40px; height: 40px; border-radius: 8px; object-fit: contain; background: #f0f4f8; }
    .sim-vendor-name { font-size: 1rem; font-weight: 600; color: var(--sim-dark); }
    .sim-header-spacer { flex: 1; }
    .sim-powered { font-size: 0.7rem; color: #6c757d; }
    .sim-powered a { color: var(--sim-primary); text-decoration: none; }
    
    /* === 單欄容器（桌機手機通用）=== */
    .sim-container {
      max-width: 640px; margin: 0 auto; padding: 1rem;
      background: #fff; min-height: calc(100vh - 60px);
    }
    @media (max-width: 767.98px) {
      .sim-container { padding: 0.75rem; }
    }
    
    .sim-step {
      border: 1px solid var(--sim-border); border-radius: 8px;
      margin-bottom: 0.75rem; overflow: hidden;
    }
    .sim-step-header {
      display: flex; align-items: center; padding: 0.75rem 1rem;
      background: #f8fafc; cursor: pointer; user-select: none;
    }
    .sim-step-header:hover { background: #e8ecf0; }
    .sim-step-number {
      width: 24px; height: 24px; border-radius: 50%; background: var(--sim-primary);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 600; flex-shrink: 0;
    }
    .sim-step-title { flex: 1; margin-left: 0.75rem; font-weight: 600; font-size: 0.9rem; }
    .sim-step-chevron { transition: transform 0.2s; }
    .sim-step.expanded .sim-step-chevron { transform: rotate(180deg); }
    .sim-step-body {
      padding: 1rem; display: none;
    }
    .sim-step.expanded .sim-step-body { display: block; }
    .sim-step-summary {
      padding: 0.5rem 1rem; background: #f0f9ff; border-top: 1px solid var(--sim-border);
      font-size: 0.8rem; color: #0369a1; display: none;
    }
    .sim-step.has-selection .sim-step-summary { display: block; }
    
    /* === 結果區（插在生成按鈕後）=== */
    .sim-result-section {
      margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--sim-border);
      text-align: center;
    }
    .sim-result-placeholder {
      padding: 3rem 1rem; color: #94a3b8;
    }
    .sim-result-placeholder i { font-size: 3rem; opacity: 0.5; margin-bottom: 0.75rem; }
    .sim-result-img {
      max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .sim-result-actions { margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center; }
    
    /* === Step 內容 === */
    .sim-proto-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    .sim-proto-card {
      border: 2px solid transparent; border-radius: 8px; overflow: hidden; cursor: pointer;
      transition: all 0.15s;
    }
    .sim-proto-card:hover { border-color: var(--sim-primary); }
    .sim-proto-card.selected { border-color: var(--sim-primary); box-shadow: 0 0 0 3px rgba(68,93,126,0.1); }
    .sim-proto-img { width: 100%; aspect-ratio: 1; object-fit: cover; }
    .sim-proto-name { padding: 0.5rem; font-size: 0.8rem; text-align: center; background: #fff; }
    
    .sim-material-list, .sim-part-list {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1rem;
    }
    .sim-mat-item {
      aspect-ratio: 1; border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden;
      cursor: pointer; position: relative; transition: all 0.15s;
    }
    .sim-mat-item:hover { border-color: var(--sim-primary); }
    .sim-mat-item.selected { border-color: var(--sim-primary); box-shadow: 0 0 0 3px rgba(68,93,126,0.1); }
    .sim-mat-img { width: 100%; height: 100%; object-fit: cover; }
    .sim-mat-checkmark {
      position: absolute; top: 4px; right: 4px; width: 20px; height: 20px;
      background: var(--sim-primary); border-radius: 50%; color: #fff;
      display: none; align-items: center; justify-content: center; font-size: 0.7rem;
    }
    .sim-mat-item.selected .sim-mat-checkmark { display: flex; }
    
    .sim-cap-options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .sim-cap-checkbox { display: flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.75rem;
      border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
    }
    .sim-cap-checkbox:hover { background: #f1f5f9; }
    .sim-cap-checkbox input[type="checkbox"] { margin: 0; }
    
    .sim-prompt-textarea {
      width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.9rem; resize: vertical; min-height: 80px;
    }
    .sim-prompt-hint { font-size: 0.75rem; color: #64748b; margin-top: 0.35rem; }
    
    .sim-generate-btn {
      width: 100%; padding: 0.75rem; background: var(--sim-primary); color: #fff;
      border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;
      transition: all 0.15s;
    }
    .sim-generate-btn:hover { background: var(--sim-dark); }
    .sim-generate-btn:disabled { background: #94a3b8; cursor: not-allowed; }
    
    .sim-loading { display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: #64748b; }
    .sim-spinner { border: 3px solid #e2e8f0; border-top-color: var(--sim-primary);
      border-radius: 50%; width: 24px; height: 24px; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .sim-error { padding: 0.75rem 1rem; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
      color: #991b1b; font-size: 0.85rem; margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="sim-header">
    <img id="simLogo" class="sim-logo" src="" alt="">
    <span id="simVendorName" class="sim-vendor-name">載入中…</span>
    <div class="sim-header-spacer"></div>
    <span class="sim-powered">Powered by <a href="https://matchdo.cc" target="_blank">Matchdo</a></span>
  </header>
  
  <!-- 單欄容器 -->
  <div class="sim-container">
        
        <!-- Step 1: 選款式 -->
        <div class="sim-step expanded" id="step1" data-step="prototype">
          <div class="sim-step-header" onclick="toggleStep(1)">
            <span class="sim-step-number">1</span>
            <span class="sim-step-title">選擇款式</span>
            <i class="bi bi-chevron-down sim-step-chevron"></i>
          </div>
          <div class="sim-step-body">
            <div id="prototypeGrid" class="sim-proto-grid">
              <!-- JS 動態填充 -->
            </div>
          </div>
          <div class="sim-step-summary" id="step1Summary">
            已選：<span id="step1SelectedName">—</span>
          </div>
        </div>
        
        <!-- Step 2: 材料與配件 -->
        <div class="sim-step" id="step2" data-step="materials" style="display:none;">
          <div class="sim-step-header" onclick="toggleStep(2)">
            <span class="sim-step-number">2</span>
            <span class="sim-step-title">材料與配件（選填）</span>
            <i class="bi bi-chevron-down sim-step-chevron"></i>
          </div>
          <div class="sim-step-body">
            <div id="materialSection" style="display:none;">
              <label class="small fw-semibold mb-2 d-block">材料（單選）</label>
              <div id="materialList" class="sim-material-list"></div>
            </div>
            <div id="partSection" style="display:none;">
              <label class="small fw-semibold mb-2 d-block">配件（可複選）</label>
              <div id="partList" class="sim-part-list"></div>
            </div>
            <p id="noMaterials" class="text-muted small mb-0">此款式無關聯材配</p>
          </div>
          <div class="sim-step-summary" id="step2Summary">
            已選 <span id="step2Count">0</span> 項
          </div>
        </div>
        
        <!-- Step 3: 表面工藝 -->
        <div class="sim-step" id="step3" data-step="capabilities" style="display:none;">
          <div class="sim-step-header" onclick="toggleStep(3)">
            <span class="sim-step-number">3</span>
            <span class="sim-step-title">表面工藝（選填）</span>
            <i class="bi bi-chevron-down sim-step-chevron"></i>
          </div>
          <div class="sim-step-body">
            <div id="capabilityOptions" class="sim-cap-options"></div>
          </div>
          <div class="sim-step-summary" id="step3Summary">
            已選 <span id="step3Count">0</span> 項
          </div>
        </div>
        
        <!-- Step 4: 描述 -->
        <div class="sim-step expanded" id="step4" data-step="prompt">
          <div class="sim-step-header" onclick="toggleStep(4)">
            <span class="sim-step-number">4</span>
            <span class="sim-step-title">描述你想要的產品</span>
            <i class="bi bi-chevron-down sim-step-chevron"></i>
          </div>
          <div class="sim-step-body">
            <textarea id="simPrompt" class="sim-prompt-textarea" placeholder="例：軍綠色，正面印 LOGO"></textarea>
            <p class="sim-prompt-hint">有參考圖時可簡短描述顏色、文字等細節。</p>
          </div>
        </div>
        
        <!-- Step 5: 生成 -->
        <div class="sim-step expanded" id="step5" data-step="generate">
          <div class="sim-step-body" style="display:block;">
            <button id="btnGenerate" class="sim-generate-btn" onclick="handleGenerate()">
              立即生成
            </button>
            <div id="generateStatus" class="sim-loading" style="display:none;">
              <div class="sim-spinner"></div>
              <span>生成中…</span>
            </div>
            <div id="generateError" class="sim-error" style="display:none;"></div>
          </div>
        </div>
    
    <!-- 結果區（生成後顯示）-->
    <section id="resultSection" class="sim-result-section" style="display:none;">
      <div id="resultPlaceholder" class="sim-result-placeholder">
        <i class="bi bi-magic"></i>
        <p>選擇款式與描述後<br>點擊「立即生成」查看效果</p>
      </div>
      <div id="resultContent" style="display:none;">
        <img id="resultImg" class="sim-result-img" src="" alt="生成結果">
        <div class="sim-result-actions">
          <button class="btn btn-outline-secondary btn-sm" onclick="handleRegenerate()">
            <i class="bi bi-arrow-repeat"></i> 再生成一次
          </button>
          <a id="resultDownload" class="btn btn-outline-primary btn-sm" href="" download>
            <i class="bi bi-download"></i> 下載
          </a>
        </div>
      </div>
    </section>
  </div>
  
  <script src="/js/embed-simulator.js"></script>
</body>
</html>
```

---

## 3. JS 互動邏輯（`embed-simulator.js`）

### 3.1 全域狀態管理

```javascript
// embed-simulator.js
(function() {
  const BUILD = 'embed-simulator-20260627';
  const params = new URLSearchParams(window.location.search);
  const embedId = params.get('embed_id');
  const sig = params.get('sig');
  
  // 全域狀態
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
  
  function getOrCreateSessionId() {
    let sid = localStorage.getItem('embed_session_id');
    if (!sid) {
      sid = 'emb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('embed_session_id', sid);
    }
    return sid;
  }
  
  // 初始化
  async function init() {
    if (!embedId || !sig) {
      showError('無效的嵌入連結');
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
      showError('網路錯誤，請稍後再試');
    }
  }
  
  function renderHeader() {
    document.getElementById('simLogo').src = state.manufacturer.logo_url || '/img/placeholder-logo.png';
    document.getElementById('simVendorName').textContent = state.manufacturer.name || '廠商';
    document.title = `產品試做 - ${state.manufacturer.name}`;
  }
  
  // ... 以下各 function 見 §3.2–3.6
  
  init();
  window.toggleStep = toggleStep;
  window.handleGenerate = handleGenerate;
  window.handleRegenerate = handleRegenerate;
})();
```

### 3.2 Step 1 — 選原型

```javascript
function renderPrototypes() {
  const grid = document.getElementById('prototypeGrid');
  grid.innerHTML = state.prototypes.map(p => `
    <div class="sim-proto-card" data-id="${p.id}" onclick="selectPrototype('${p.id}')">
      <img class="sim-proto-img" src="${p.image_url || '/img/placeholder.png'}" alt="${p.title}">
      <div class="sim-proto-name">${p.title || '款式'}</div>
    </div>
  `).join('');
}

async function selectPrototype(protoIdOrObj) {
  const proto = typeof protoIdOrObj === 'string' 
    ? state.prototypes.find(p => p.id === protoIdOrObj)
    : protoIdOrObj;
  
  state.selectedPrototype = proto;
  
  // UI 更新
  document.querySelectorAll('.sim-proto-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === proto.id);
  });
  document.getElementById('step1').classList.add('has-selection');
  document.getElementById('step1SelectedName').textContent = proto.title;
  
  // 收起 Step 1（若有多款）
  if (state.prototypes.length > 1) {
    document.getElementById('step1').classList.remove('expanded');
  }
  
  // 載入材配 + 工藝
  await loadLinkTree(proto.id);
  loadCapabilities(proto.id);
  
  // 展開 Step 2（若有材配）
  if (state.materials.length || state.parts.length) {
    document.getElementById('step2').style.display = '';
    document.getElementById('step2').classList.add('expanded');
  }
}

async function loadLinkTree(protoId) {
  try {
    const res = await fetch(`/api/embed/simulator/link-tree?embed_id=${embedId}&sig=${sig}&prototype_asset_id=${protoId}`);
    const data = await res.json();
    state.materials = data.materials || [];
    state.parts = data.parts || [];
    
    renderMaterials();
    renderParts();
  } catch (e) {
    console.warn('載入材配失敗:', e);
  }
}

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
    <div class="sim-mat-item" data-id="${m.id}" onclick="selectMaterial('${m.id}')">
      <img class="sim-mat-img" src="${m.image_url}" alt="${m.title}">
      <i class="sim-mat-checkmark bi bi-check"></i>
    </div>
  `).join('');
}

function selectMaterial(matId) {
  // 單選：清空後選中
  state.selectedMaterials = [matId];
  document.querySelectorAll('#materialList .sim-mat-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === matId);
  });
  updateStep2Summary();
}
```

### 3.3 Step 2 — 選配件

```javascript
function renderParts() {
  const section = document.getElementById('partSection');
  const list = document.getElementById('partList');
  
  if (!state.parts.length) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  list.innerHTML = state.parts.map(p => `
    <div class="sim-mat-item" data-id="${p.id}" onclick="togglePart('${p.id}')">
      <img class="sim-mat-img" src="${p.image_url}" alt="${p.title}">
      <i class="sim-mat-checkmark bi bi-check"></i>
    </div>
  `).join('');
}

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

function updateStep2Summary() {
  const count = state.selectedMaterials.length + state.selectedParts.length;
  document.getElementById('step2Count').textContent = count;
  document.getElementById('step2').classList.toggle('has-selection', count > 0);
}
```

### 3.4 Step 3 — 工藝

```javascript
async function loadCapabilities(protoId) {
  try {
    const res = await fetch(`/api/embed/simulator/capabilities?embed_id=${embedId}&sig=${sig}&prototype_asset_id=${protoId}`);
    const data = await res.json();
    state.capabilities = data.capabilities || [];
    
    if (!state.capabilities.length) return;
    
    document.getElementById('step3').style.display = '';
    const options = document.getElementById('capabilityOptions');
    options.innerHTML = state.capabilities.map(c => `
      <label class="sim-cap-checkbox">
        <input type="checkbox" value="${c.key}" onchange="toggleCapability('${c.key}')">
        <span>${c.label}</span>
      </label>
    `).join('');
  } catch (e) {
    console.warn('載入工藝失敗:', e);
  }
}

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
```

### 3.5 Step 5 — 生成

```javascript
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
    
  } catch (e) {
    error.textContent = e.message;
    error.style.display = 'block';
  } finally {
    btn.disabled = false;
    status.style.display = 'none';
    state.generating = false;
  }
}

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
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function handleRegenerate() {
  // 再生成 = 再呼叫一次 generate（計額度）
  handleGenerate();
}
```

### 3.6 通用

```javascript
function toggleStep(stepNum) {
  const step = document.getElementById(`step${stepNum}`);
  step.classList.toggle('expanded');
}

function showError(msg) {
  document.querySelector('.sim-steps').innerHTML = `
    <div class="sim-error">${msg}</div>
  `;
}
```

---

## 4. 佈局實作細節

### 4.1 單欄置中容器

```css
.sim-container {
  max-width: 640px;  /* 桌機限寬 */
  margin: 0 auto;    /* 置中 */
  padding: 1rem;     /* 內距 */
  background: #fff;
}
@media (max-width: 767.98px) {
  .sim-container {
    padding: 0.75rem;  /* 手機縮小內距 */
  }
}
```

### 4.2 Accordion 展開邏輯（桌機手機相同）

- 預設 Step 1、4 展開（選款式 + 描述）
- 選完原型後自動收起 Step 1、展開 Step 2（若有材配）
- 用 JS `classList.toggle('expanded')` 控制

### 4.3 結果圖 RWD

```css
.sim-result-img {
  max-width: 100%;  /* 不超出容器 */
  height: auto;     /* 保持比例 */
  border-radius: 12px;
}
```

**說明**：因容器已限寬 640px，成圖（1024×1024）會自動縮放，桌機手機都適用。

---

## 5. 與現有程式重用

| 邏輯 | 來源 | 如何重用 | 差異 |
|------|------|----------|------|
| 原型列表 | `vendor-catalog.html` | 複製 2×2 grid 卡片 render | embed 版無外連、無「看可搭配」 |
| 材配選取 | `product-tree.html` 右側 grid | 精簡成單區 3×3 grid | 無左側原型切換、無「進入設計」按鈕 |
| 工藝勾選 | `custom-product.html` capabilities | 複製 checkbox 邏輯 | 無長說明 Modal、無工藝圖示 |
| 生成 API | **新建** `/api/embed/simulator/generate` | 不可沿用現有 `/api/generate-product-image` | 簽名驗證、廠商扣點、限流、寫 `vendor_embed_designs` |
| 結果顯示 | `custom-product.html` result area | 精簡成單圖 + 2 按鈕 | 無變體 grid、無「加入作品集」 |

---

## 6. 檔案清單（Phase C）

```
public/
├─ embed/
│  └─ simulator.html           (約 200 行 HTML + 120 行內嵌 CSS)
└─ js/
   └─ embed-simulator.js       (約 350 行)
```

**說明**：
- 單欄版更簡潔，HTML 約 200 行
- CSS 內嵌在 `<style>` 即可，無需分離
- 測試時直接在廠商網站 iframe 或用瀏覽器開 `/embed/simulator.html?embed_id=xxx&sig=yyy`

---

## 7. 開發順序建議

1. **先做靜態 HTML**（§2.1）：寫死假資料，確認單欄 Accordion 佈局 OK
2. **JS 填充原型列表**（§3.2）：呼叫 bootstrap API，渲染 2×2 卡片 grid
3. **選原型 → 載材配**（§3.2 + §3.3）：link-tree API，渲染材料 + 配件 3×3 grid
4. **工藝 + prompt**（§3.4）：capabilities API，勾選 checkbox
5. **生成按鈕 + 結果顯示**（§3.5）：generate API（需後端先完成 Phase B2）
6. **捲動 UX**：成圖顯示後自動 `scrollIntoView`
7. **錯誤處理**：對應 PROGRESS §7 錯誤碼文案（額度用盡、限流、簽名無效）
8. **測試**：桌機（640px 置中）、手機（100% 寬）、平板（都正常）

---

## 8. 測試 Checklist

- [ ] 桌機容器 640px 置中、手機 100% 寬
- [ ] Accordion 展開／收起流暢（桌機手機相同）
- [ ] 單款自動選中且 Step 1 摺疊
- [ ] 材料單選、配件複選邏輯正確
- [ ] 工藝勾選計數正確
- [ ] 生成按鈕 disabled 期間不可重複點擊
- [ ] 成圖顯示後自動捲動到結果區
- [ ] 成圖在容器內正確縮放（不超出 640px）
- [ ] 「再生成」仍受限流
- [ ] 錯誤文案對應 PROGRESS §7
- [ ] 訪客可右鍵下載成圖
- [ ] header「Powered by Matchdo」連結可點

---

**最後更新**：2026-06-27  
**搭配文件**：[`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md)
